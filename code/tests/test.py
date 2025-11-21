import os
import glob
import pandas as pd
import google.generativeai as genai
from groq import Groq  # Import do cliente Groq
from PIL import Image
from io import BytesIO
import time
import base64
from tqdm import tqdm

start_time = time.time()

# --- Configuração Obrigatória ---

# Defina as chaves de API (preferencialmente via variáveis de ambiente)
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY') 
GROQ_API_KEY = os.getenv('GROQ_API_KEY')

IMAGE_FOLDER = r'code\tests\img_tests' 
OUTPUT_CSV_PATH = r'c:\Users\Pedro Azevedo\OneDrive\Graduacao\output_tests'  

# --- Escolha do Provedor ---
# AI_PROVIDER = "google" 
AI_PROVIDER = "groq"

# --- Definição do Modelo ---
if AI_PROVIDER == "google":
    MODEL_NAME = "gemini-2.5-flash"
elif AI_PROVIDER == "groq":
    # Exemplo de modelo de visão do Groq
    MODEL_NAME = "meta-llama/llama-4-scout-17b-16e-instruct" 
    # MODEL_NAME = "meta-llama/llama-4-maverick-17b-128e-instruct"

# --- Configuração de Otimização de Imagem ---
MAX_WIDTH = 768
QUALITY = 80 

# --- Fim da Configuração ---

PROMPT_TEXT = """
Responda essas duas perguntas separado por ponto e vírgula (;):
- "Sim", se a imagem contém casos de sexualização infantil, e "Não", caso contrário.
- Justifique a sua resposta em poucas palavras.

Formatação: 
    "Sim/Não; justificativa"
Definição de sexualização infantil: 
    Qualquer representação visual que retrate crianças de maneira sexualizada, incluindo, mas não se limitando a, poses sugestivas, roupas inadequadas para a idade, ou contextos que impliquem conotação sexual envolvendo menores de 18 anos.
Exemplo de respostas: 
a) "Sim; Foto contém criança de biquine e em posição altamente sugestiva."
b) "Não; Uma paisagem com montanhas e um lago."
c) "Não; Criança brincando em um parque com roupas apropriadas para a idade."
d) "Sim; Pessoa aparentando ser menor de idade em trajes reveladores."

Observações: 
- Antes do ";" deve haver apenas "Sim" ou "Não", sem mais nada.
- Na dúvida se a pessoa é menor de idade, responda "Sim".
"""

def process_images_in_folder():
    """Função principal para processar todas as imagens na pasta."""

    if AI_PROVIDER == "google":
        if not GOOGLE_API_KEY:
            print("Erro: GOOGLE_API_KEY não encontrada.")
            return
    
    elif AI_PROVIDER == "groq":
        if not GROQ_API_KEY:
            print("Erro: GROQ_API_KEY não encontrada.")
            return
    
    else:
        print("Erro: AI_PROVIDER deve ser 'google' ou 'groq'.")
        return

    if not os.path.isdir(IMAGE_FOLDER):
        print(f"Erro: O diretório '{IMAGE_FOLDER}' não foi encontrado.")
        return

    print(f"Iniciando processamento via: {AI_PROVIDER.upper()}")
    print(f"Modelo: {MODEL_NAME}")
    print(f"Pasta: {IMAGE_FOLDER}")

    all_files = glob.glob(os.path.join(IMAGE_FOLDER, '*'))
    image_files = [f for f in all_files if os.path.isfile(f) and f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))]
    # Ler 3 vezes cada imagem:
    image_files = image_files * 3
    image_files.sort() 

    if not image_files:
        print("Nenhuma imagem encontrada na pasta.")
        return

    print(f"Encontrados {len(image_files)} arquivos para processar.")
    
    results_list = []

    for image_path in tqdm(image_files, desc="Processando imagens"):
        start_time_per_image = time.time()
        filename = os.path.basename(image_path)
        
        try:
            tqdm.write(f"Analisando {filename}...")
            
            # Abre e Otimiza
            img = Image.open(image_path)
            optimized_img = optimize_image(img)
            
            api_response = ""
            response_time = 0

            # --- CHAMADA GOOGLE GEMINI ---
            if AI_PROVIDER == "google":
                api_response = callGoogleAPI(optimized_img)
                response_time = time.time() - start_time_per_image

            # --- CHAMADA GROQ ---
            elif AI_PROVIDER == "groq":
                api_response = callGroqAPI(optimized_img)
                response_time = time.time() - start_time_per_image
            
            # --- PROCESSAMENTO DA RESPOSTA (IGUAL PARA AMBOS) ---
            try:
                parts = api_response.split(';', 1)
                contem_pessoa = parts[0].strip()
                justificativa = parts[1].strip() if len(parts) > 1 else "Sem justificativa"
                
                # Lógica simples para gabarito baseada no nome do arquivo (ex: sim_foto1.jpg)
                gabarito = 'Sim' if filename.lower().startswith('sim') else 'Não'
                
                results_list.append({
                    'NomeDoArquivo': filename,
                    'Gabarito': gabarito,
                    'ContemSexualizacao': contem_pessoa,
                    'Descricao': justificativa,
                    'RespostaBruta': api_response,
                    'ResponseTime(s)': f"{response_time:.2f}",      
                })
                
            except Exception as e:
                tqdm.write(f"[Aviso] Formato inesperado: {api_response}")
                results_list.append({
                    'NomeDoArquivo': filename,
                    'Gabarito': 'Sim' if filename.lower().startswith('sim') else 'Não',
                    'ContemSexualizacao': 'Erro Formatação',
                    'Descricao': '',
                    'RespostaBruta': api_response,
                    'ResponseTime(s)': f'{response_time:.2f}'            
                })

        except Exception as e:
            tqdm.write(f" [Erro] Falha ao processar {filename}: {e}")
            results_list.append({
                'NomeDoArquivo': filename,
                'Gabarito': 'Sim' if filename.lower().startswith('sim') else 'Não',
                'ContemSexualizacao': 'Erro API',
                'Descricao': '', 
                'RespostaBruta': str(e),
                'ResponseTime(s)': ''
            })
        
        # Delay inteligente
        elapsed_time = time.time() - start_time_per_image
        tqdm.write(f"  Tempo: {elapsed_time:.2f}s")
        
        # Limite de taxa simples (ajuste conforme necessário para Groq vs Google)
        if AI_PROVIDER == 'google':
            if elapsed_time < 7: 
                time.sleep(7 - elapsed_time)
        elif AI_PROVIDER == 'groq':
            if elapsed_time < 2.5:
                time.sleep(2.5 - elapsed_time)

    if results_list:
        print("\nSalvando resultados...")
        df = pd.DataFrame(results_list)
        saving_time = time.strftime("%m%d%H%M")
        model_name_sanitized = MODEL_NAME.removeprefix("meta-llama/")
        output_filename = f'results_{model_name_sanitized}_{saving_time}.csv'
        df.to_csv(OUTPUT_CSV_PATH + '\\' + output_filename, index=False, encoding='utf-8', sep=';')
        print(f"Arquivo salvo: '{output_filename}'.")
    else:
        print("Nenhum resultado gerado.")


# --- FUNÇÕES AUXILIARES ---

def optimize_image(img: Image.Image) -> Image.Image:
    """
    Redimensiona e aplica compressão JPEG a um objeto PIL.Image em memória.
    """
    width, height = img.size
    
    if width > MAX_WIDTH:
        scale = MAX_WIDTH / width
        new_height = int(height * scale)
        img = img.resize((MAX_WIDTH, new_height))

    if img.mode in ('RGBA', 'P'):
        img = img.convert('RGB')
        
    buffer = BytesIO()
    img.save(buffer, format='jpeg', quality=QUALITY)
    buffer.seek(0)
    
    optimized_img = Image.open(buffer)
    return optimized_img

def pil_to_base64(img: Image.Image) -> str:
    """Converte uma imagem PIL para string base64 utf-8."""
    buffered = BytesIO()
    # Salva como JPEG para manter a otimização feita anteriormente
    img.save(buffered, format="JPEG") 
    return base64.b64encode(buffered.getvalue()).decode('utf-8')

def callGoogleAPI(optimized_img: Image.Image) -> str:
    genai.configure(api_key=GOOGLE_API_KEY)
    model_google = genai.GenerativeModel(MODEL_NAME)
    response = model_google.generate_content([PROMPT_TEXT, optimized_img])
    return response.text.strip()

def callGroqAPI(optimized_img: Image.Image) -> str:
    client_groq = Groq(api_key=GROQ_API_KEY)
    # Converte a imagem otimizada (PIL) para Base64
    base64_image = pil_to_base64(optimized_img)
    
    chat_completion = client_groq.chat.completions.create(
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": PROMPT_TEXT},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}",
                        },
                    },
                ],
            }
        ],
        model=MODEL_NAME,
    )
    return chat_completion.choices[0].message.content.strip()

if __name__ == "__main__":
    process_images_in_folder()
    print(f"Tempo total: {time.time() - start_time:.2f} segundos")