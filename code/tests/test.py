import os
import glob
import pandas as pd # Usaremos pandas para salvar o CSV, é mais fácil
import google.generativeai as genai
from PIL import Image # Usado para abrir e manipular as imagens
from io import BytesIO # Usado para manipular dados binários em memória
import time

start_time = time.time()

# --- Configuração Obrigatória ---

# # 1. Cole sua Chave de API do Google AI Studio aqui
API_KEY = os.getenv('API_KEY')  

# 2. Defina o caminho para a pasta que contém suas imagens
IMAGE_FOLDER = r'C:\Users\Pedro Azevedo\OneDrive\Graduação\12° Período\TCC\code\tests\img_tests' # Ex: r"C:\Users\MeuNome\Fotos"

# 3. Nome do modelo
MODEL_NAME = "gemini-2.5-flash-lite"

# 4. Nome do arquivo de saída
OUTPUT_CSV_FILE = r'C:\Users\Pedro Azevedo\OneDrive\Graduação\12° Período\TCC\code\tests\results_gemini25flash.csv'

# --- Configuração de Otimização de Imagem (NOVA) ---
MAX_WIDTH = 768
QUALITY = 80  # 0.8 * 100, para a escala de 0 a 100 do Pillow
# --- Fim da Configuração ---

# O mesmo prompt de antes
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

def optimize_image(img: Image.Image) -> Image.Image:
    """
    Redimensiona e aplica compressão JPEG a um objeto PIL.Image em memória.
    
    Esta função usa um 'round-trip' de BytesIO para aplicar a compressão JPEG
    (qualidade) sem salvar o arquivo no disco, retornando um novo objeto PIL.Image
    otimizado.

    Args:
        img: Objeto PIL.Image a ser otimizado.

    Returns:
        Um novo objeto PIL.Image otimizado e redimensionado.
    """
    width, height = img.size
    
    # Redimensiona apenas se a largura for maior que a largura máxima
    if width > MAX_WIDTH:
        scale = MAX_WIDTH / width
        new_height = int(height * scale)
        img = img.resize((MAX_WIDTH, new_height))

    # Converte para RGB se for necessário, para evitar problemas ao salvar como JPEG
    if img.mode in ('RGBA', 'P'):
        img = img.convert('RGB')
        
    # Salva a imagem redimensionada e comprimida em um buffer de memória (BytesIO)
    buffer = BytesIO()
    img.save(buffer, format='jpeg', quality=QUALITY)
    buffer.seek(0)
    
    # Reabre o buffer como um novo objeto PIL.Image
    # Isso garante que a compressão foi aplicada corretamente para o SDK do Gemini.
    optimized_img = Image.open(buffer)
    
    return optimized_img


def process_images_in_folder():
    """Função principal para processar todas as imagens na pasta."""
    
    if API_KEY == "SUA_API_KEY_AQUI":
        print("Erro: Por favor, configure sua API_KEY no início do script.")
        return

    if not os.path.isdir(IMAGE_FOLDER):
        print(f"Erro: O diretório '{IMAGE_FOLDER}' não foi encontrado.")
        return

    # 1. Configura a API
    genai.configure(api_key=API_KEY)

    # 2. Inicializa o modelo
    model = genai.GenerativeModel(MODEL_NAME)

    print(f"Iniciando processamento com o modelo: {MODEL_NAME}...")
    print(f"Pasta de Imagens: {IMAGE_FOLDER}")
    print(f"Otimização: Max Width={MAX_WIDTH}px, Qualidade JPEG={QUALITY}%")

    print('procurando em:', IMAGE_FOLDER + os.sep + '*')
    
    # Usando glob para encontrar APENAS arquivos (se IMAGE_FOLDER for um diretório)
    # A maneira mais segura de buscar arquivos sem incluir subpastas
    all_files = glob.glob(os.path.join(IMAGE_FOLDER, '*'))
    image_files = [f for f in all_files if os.path.isfile(f)]

    if not image_files:
        print("Nenhum arquivo encontrado na pasta.")
        return

    print(f"Encontrados {len(image_files)} arquivos para processar.")
    
    # Lista para guardar todos os nossos resultados
    results_list = []

    # 3. Itera sobre cada imagem
    for image_path in image_files:
        start_time_per_image = time.time()

        filename = os.path.basename(image_path)
        
        try:
            print(f"Analisando {filename}...")
            
            # 4. Abre a imagem original
            img = Image.open(image_path)
            
            # 5. OTIMIZAÇÃO APLICADA AQUI!
            optimized_img = optimize_image(img)
            
            # 6. Envia o prompt e a IMAGEM OTIMIZADA para o modelo
            response = model.generate_content([PROMPT_TEXT, optimized_img])
            
            # 7. Pega o texto da resposta
            api_response = response.text.strip()
            
            # Tenta dividir a resposta no formato "Sim/Não; Descrição"
            try:
                parts = api_response.split(';', 1)
                contem_pessoa = parts[0].strip()
                justificativa = parts[1].strip()
                gabarito = 'Sim' if filename[:3] == 'sim' else 'Não'
                
                results_list.append({
                    'NomeDoArquivo': filename,
                    'Gabarito': gabarito,
                    'ContemSexualizacao': contem_pessoa,
                    'Descricao': justificativa,
                    'RespostaBruta': api_response
                })
                
            except Exception as e:
                gabarito = 'Sim' if filename[:3] == 'sim' else 'Não'
                # O modelo não formatou a resposta corretamente
                print(f"[Aviso] Modelo não respondeu no formato esperado: {api_response}")
                results_list.append({
                    'NomeDoArquivo': filename,
                    'Gabarito': gabarito,
                    'ContemSexualizacao': 'Erro',
                    'Descricao': '',
                    'RespostaBruta': api_response
                })

        except Exception as e:
            # Captura erros da API (ex: conteúdo bloqueado, timeout)
            print(f" [Erro] Falha ao processar {filename}: {e}")
            gabarito = 'Sim' if filename[:3] == 'sim' else 'Não'

            results_list.append({
                'NomeDoArquivo': filename,
                'Gabarito': gabarito,
                'ContemSexualizacao': 'Erro',
                'Descricao': '', 
                'RespostaBruta': str(e)
            })
        
        # Pausa para evitar limites de taxa (mantido por precaução)
        elapsed_time = time.time() - start_time_per_image
        print(f"  Tempo de processamento: {elapsed_time:.2f} segundos")
        if elapsed_time < 7:
            time.sleep(7 - elapsed_time)
            print(f"  Pausa extra: {7 - elapsed_time:.2f} segundos")

    # 8. Salva tudo em um CSV de uma só vez usando Pandas
    if results_list:
        print("\nFinalizando e salvando resultados...")
        df = pd.DataFrame(results_list)
        df.to_csv(OUTPUT_CSV_FILE, index=False, encoding='utf-8')
        print(f"Processamento concluído! Os resultados foram salvos em '{OUTPUT_CSV_FILE}'.")
    else:
        print("Nenhum resultado foi gerado.")

# --- Executa o script ---
if __name__ == "__main__":
    process_images_in_folder()
    print(f"Tempo total de execução: {time.time() - start_time:.2f} segundos")
