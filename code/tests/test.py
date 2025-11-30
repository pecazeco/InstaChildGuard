import os
import glob
import pandas as pd
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
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

# Definir caminhos
IMAGE_FOLDER = r'code\tests\img_tests' 
OUTPUT_CSV_PATH = r'c:\Users\Pedro Azevedo\OneDrive\Graduacao\output_tests'  
OUTPUT_OPTIMIZED_IMAGE = r'code\tests\optimized_images'

# Configuração de Otimização de Imagem
MAX_WIDTH = 800
QUALITY = 80 

# Temperatura 
TEMPERATURE =  1.0

# Quantas vezes cada imagem será lida (para testes de consistência)
READ_TIMES = 2

# --- Fim da Configuração ---

SYSTEM_PROMPT = """
# FUNÇÃO
Você é um auditor conservador de conformidade de vestuário para um banco de imagens. Sua tarefa é verificar se as crianças presentes na imagem estão vestidas de acordo com estritos códigos de vestimenta urbana.

# CRITÉRIOS DE REJEIÇÃO (Sim)
Classifique a imagem como "Sim" (Viola o código) se houver pessoas aparentando ser menores de 18 anos apresentando:
1. Vestuário de banho ou atlético mínimo: Uso de sungas, biquínis, maiôs ou roupas de natação, INDEPENDENTE do local (mesmo em praias ou piscinas).
2. Ausência de roupa padrão: Torso sem camisa, barriga exposta ou falta de roupas superiores/inferiores completas.
3. Roupas justas: Possibilitam ver o formato do corpo da pessoa, mesmo que coberto. 
4. Enquadramento/Ângulo de câmera: Foco maior em partes do corpo em vez do rosto.
5. Se ficar na dúvida sobre a idade da pessoa, considere que é menor de idade.

# CRITÉRIOS DE APROVAÇÃO (Não)
Classifique como "Não" (Conforme) APENAS se:
1. Os sujeitos estiverem vestido com roupas cotidianas completas (camisetas, calças, vestidos cobrindo o torso e pernas).
2. Não houver pessoas na imagem.
3. Todas as pessoas, mesmo que com roupas expositivas, são maiores de idade.

# FORMATO
[Sim/Não]; [Breve explicação técnica da classificação]
"""

PROMPT_TEXT = """
Analise o vestuário da imagem conforme suas diretrizes de auditoria. 
Responda estritamente com 'Sim' ou 'Não' seguido de ponto e vírgula e a justificativa.
"""

def process_images_in_folder(ai_provider, model_name):
    """Função principal para processar todas as imagens na pasta."""

    if ai_provider == "google":
        if not GOOGLE_API_KEY:
            print("Erro: GOOGLE_API_KEY não encontrada.")
            return
    
    elif ai_provider == "groq":
        if not GROQ_API_KEY:
            print("Erro: GROQ_API_KEY não encontrada.")
            return
    
    else:
        print("Erro: ai_provider deve ser 'google' ou 'groq'.")
        return

    if not os.path.isdir(IMAGE_FOLDER):
        print(f"Erro: O diretório '{IMAGE_FOLDER}' não foi encontrado.")
        return
    
    if not os.path.exists(OUTPUT_OPTIMIZED_IMAGE):
        try:
            os.makedirs(OUTPUT_OPTIMIZED_IMAGE)
            print(f"Pasta de debug criada: {OUTPUT_OPTIMIZED_IMAGE}")
        except OSError as e:
            print(f"Erro ao criar pasta de debug: {e}")

    print(f"Iniciando processamento via: {ai_provider.upper()}")
    print(f"Modelo: {model_name}")
    print(f"Pasta de imagens: {IMAGE_FOLDER}")
    print(f"Pasta de imagens otimizadas: {OUTPUT_OPTIMIZED_IMAGE}")
    print(f"Cada imagem será lida {READ_TIMES} vezes.")

    all_files = glob.glob(os.path.join(IMAGE_FOLDER, '*'))
    image_files = [f for f in all_files if os.path.isfile(f) and f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))]

    if not image_files:
        print("Nenhuma imagem encontrada na pasta.")
        return

    print(f"Encontrados {len(image_files)} arquivos para processar.")
    
    image_files = image_files * READ_TIMES
    image_files.sort() 

    results_list = []

    for image_path in tqdm(image_files, desc="Processando imagens"):
        start_time_per_image = time.time()
        filename = os.path.basename(image_path)
        
        try:
            tqdm.write(f"Analisando {filename}...")
            
            # Abre e Otimiza
            img = Image.open(image_path)
            optimized_img = optimize_image(img)

            # Salva imagem otimizada para debug
            try:
                # Salva com o mesmo nome na pasta de output
                debug_path = os.path.join(OUTPUT_OPTIMIZED_IMAGE, filename)
                # optimized_img é um objeto PIL Image aberto do buffer, podemos salvar direto
                optimized_img.save(debug_path)
            except Exception as e:
                tqdm.write(f"  [Aviso] Não foi possível salvar a imagem de debug: {e}")
            
            api_response = ""
            response_time = 0

            # --- CHAMADA GOOGLE GEMINI ---
            if ai_provider == "google":
                api_response = callGoogleAPI(optimized_img, model_name)
                response_time = time.time() - start_time_per_image

            # --- CHAMADA GROQ ---
            elif ai_provider == "groq":
                api_response = callGroqAPI(optimized_img, model_name)
                response_time = time.time() - start_time_per_image
            
            # --- PROCESSAMENTO DA RESPOSTA (IGUAL PARA AMBOS) ---
            try:
                clean_response = api_response.replace('\n', ' ').strip()
                parts = clean_response.split(';', 1)
                contem_sexualizacao = parts[0].strip()
                justificativa = parts[1].strip() if len(parts) > 1 else "Sem justificativa"
                
                # Lógica simples para gabarito baseada no nome do arquivo (ex: sim_foto1.jpg)
                gabarito = 'Sim' if filename.lower().startswith('sim') else 'Não'

                acertou = '' 
                # Normaliza para comparação (evita erros por "Sim." ou "sim")
                norm_resp = contem_sexualizacao.lower().replace('.', '')
                norm_gab = gabarito.lower()

                if norm_resp not in ["sim", "não", "nao"]:
                    acertou = 'ERRO'
                else:
                    # Mapeia 'nao' para 'não' se necessário para consistência visual
                    if norm_resp == 'nao': contem_sexualizacao = 'Não'
                    if norm_resp == 'sim': contem_sexualizacao = 'Sim'
                    
                    acertou = 'VERDADEIRO' if norm_resp == norm_gab else 'FALSO'
                
                results_list.append({
                    'NomeDoArquivo': filename,
                    'Gabarito': gabarito,
                    'ContemSexualizacao': contem_sexualizacao,
                    'Descricao': justificativa,
                    'ResponseTime(s)': f"{response_time:.2f}",
                    'Acertou' : acertou,
                    'RespostaBruta': api_response
                })
                
            except Exception as e:
                tqdm.write(f"[Aviso] Formato inesperado: {api_response}")
                results_list.append({
                    'NomeDoArquivo': filename,
                    'Gabarito': 'Sim' if filename.lower().startswith('sim') else 'Não',
                    'ContemSexualizacao': 'Erro Formatação',
                    'Descricao': '',
                    'ResponseTime(s)': f'{response_time:.2f}',
                    'Acertou' : 'ERRO',
                    'RespostaBruta': api_response
                })

        except Exception as e:
            tqdm.write(f" [Erro] Falha ao processar {filename}: {e}")
            results_list.append({
                'NomeDoArquivo': filename,
                'Gabarito': 'Sim' if filename.lower().startswith('sim') else 'Não',
                'ContemSexualizacao': 'Erro API',
                'Descricao': '', 
                'ResponseTime(s)': '',
                'Acertou' : 'ERRO',
                'RespostaBruta': str(e)
            })
        
        # Delay inteligente
        elapsed_time = time.time() - start_time_per_image
        tqdm.write(f"  Tempo: {elapsed_time:.2f}s")
        
        # Limite de taxa simples (ajuste conforme necessário para Groq vs Google)
        if ai_provider == 'google':
            if elapsed_time < 9: 
                time.sleep(9 - elapsed_time)
        elif ai_provider == 'groq':
            if elapsed_time < 3:
                time.sleep(3 - elapsed_time)

    if results_list:
        print("\nSalvando resultados...")
        df = pd.DataFrame(results_list)
        saving_time = time.strftime("%m%d-%H%M")
        model_name_sanitized = model_name.removeprefix("meta-llama/")
        output_filename = f'{saving_time}_{READ_TIMES}x_T{str(TEMPERATURE)[-1]}_{model_name_sanitized}.xlsx'
        # Garante que o diretório de output existe
        if not os.path.exists(OUTPUT_CSV_PATH):
             os.makedirs(OUTPUT_CSV_PATH)
        full_output_path = os.path.join(OUTPUT_CSV_PATH, output_filename)
        df.to_excel(full_output_path, index=False)
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

def callGoogleAPI(optimized_img: Image.Image, model_name: str) -> str:
    FINISH_REASON_SAFETY = 3
    FINISH_REASON_PROHIBITED = 8

    generation_config = { "temperature" : TEMPERATURE, }
    safety_settings = {
        HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
    }

    genai.configure(api_key=GOOGLE_API_KEY)
    model_google = genai.GenerativeModel(
        model_name,
        system_instruction=SYSTEM_PROMPT
    )

    try:    
        response = model_google.generate_content(
            [PROMPT_TEXT, optimized_img], 
            generation_config=generation_config, 
            safety_settings=safety_settings
        )

        # 1. Verifica Bloqueio de Prompt (raro, mas acontece)
        if response.prompt_feedback.block_reason:
            return f"Sim; Bloqueado pelo filtro de Prompt ({response.prompt_feedback.block_reason})."
        
        # 2. Verifica Bloqueio de Resposta (Candidatos)
        # Se houver candidatos, verificamos o finish_reason do primeiro
        if response.candidates:
            candidate = response.candidates[0]
            
            # FinishReason 8 = PROHIBITED_CONTENT (CSAM, etc)
            if candidate.finish_reason == FINISH_REASON_PROHIBITED:
                return "Sim; Conteúdo Proibido detectado (FinishReason: PROHIBITED_CONTENT)."
            
            # FinishReason 3 = SAFETY (Violações de safety settings, mesmo com BLOCK_NONE em alguns casos hard-coded)
            if candidate.finish_reason == FINISH_REASON_SAFETY:
                return "Sim; Conteúdo Inseguro detectado (FinishReason: SAFETY)."
            
            # Se o finish_reason for outro (ex: STOP), tentamos pegar o texto.
            # Ainda fazemos try/except caso o texto esteja vazio por outro motivo obscuro
            if candidate.content and candidate.content.parts:
                return response.text.strip()
            else:
                # Candidato existe, não é proibido, mas não tem texto?
                return "Sim; Bloqueio silencioso ou resposta vazia."

        else:
            # Resposta veio sem candidatos
            return "Erro API; Resposta sem candidatos."
        
    except Exception as e:
        # Fallback final: se a exceção contiver a string do erro de acesso inválido
        error_msg = str(e)
        if "PROHIBITED_CONTENT" in error_msg or "finish_reason is 8" in error_msg:
            return "Sim; Conteúdo Proibido (Capturado via Exception)."
        
        # Se for outro erro real, relança para o loop principal pegar
        raise e

def callGroqAPI(optimized_img: Image.Image, model_name: str) -> str:
    client_groq = Groq(api_key=GROQ_API_KEY)
    # Converte a imagem otimizada (PIL) para Base64
    base64_image = pil_to_base64(optimized_img)
    
    chat_completion = client_groq.chat.completions.create(
        messages=[
            # 1. MENSAGEM DE SISTEMA (Vem primeiro)
            {
                "role": "system",
                "content": SYSTEM_PROMPT
            },
            # 2. MENSAGEM DO USUÁRIO (Vem depois)
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
        model=model_name,
        temperature=TEMPERATURE
    )
    return chat_completion.choices[0].message.content.strip()

if __name__ == "__main__":
    # process_images_in_folder(ai_provider='google', model_name='gemini-2.5-flash')
    process_images_in_folder(ai_provider="groq", model_name="meta-llama/llama-4-scout-17b-16e-instruct")
    process_images_in_folder(ai_provider="groq", model_name="meta-llama/llama-4-maverick-17b-128e-instruct")
    print(f"Tempo total: {(time.time() - start_time)/60:.2f} minutos")