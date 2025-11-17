console.log("background.js: Service Worker iniciado.");

// --- LÓGICA DE NAVEGAÇÃO ---
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // envia uma mensagem quando a aba é atualizada
  console.log("background.js: Pagina atualizou.");

  if (
    changeInfo.status === "complete" &&
    tab.url &&
    tab.url.includes("https://www.instagram.com")
  ) {
    // estamos no instagram
    let location = tab.url.split("instagram.com/")[1];
    if (location) {
      location = location.split("/")[0]; // pegar a primeira palavra
    } else {
      location = ""; // Estamos no feed principal
    }
    console.log("background.js: Enviando localização:", location);
    chrome.tabs.sendMessage(tabId, location);
  }
});

// --- LÓGICA DA API ---

// ⚠️ ATENÇÃO: Esta chave está publicamente visível no seu código.
const API_KEY = "API_KEY_AQUI"; // substitua pela sua chave real
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

// --- OUVINTE DE MENSAGENS ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 👇 Ouvindo pela mensagem correta do contentScript
  if (request.type === "ANALYZE_IMAGE_URL") {
    console.log("background.js: Recebido ANALYZE_IMAGE_URL para:", request.url);

    // Chama a função de análise, passando a URL
    performImageAnalysis(request.url)
      .then((status) => {
        sendResponse({ status: status });
      })
      .catch((error) => {
        console.error("background.js: Erro no performImageAnalysis:", error);
        sendResponse({ status: 2 });
      });

    // Retorna true para resposta assíncrona
    return true;
  }
});

/**
 * Função principal que executa a análise da imagem.
 * Recebe a URL, converte, e chama a API.
 */
async function performImageAnalysis(imageURL) {
  try {
    // 1. Converte a URL da imagem para base64 (agora dentro do background)
    const imageParts = await resizeImageAndConvertToBase64(imageURL, 768, 0.8);

    // 2. Monta o corpo (body) da requisição
    const body = {
      contents: [
        {
          parts: [
            {
              text: `
                Responda essas duas perguntas separado por ponto e vírgula (;):
                - "Sim", se a imagem contém mais de 1 pessoa, e "Não", caso contrário.
                - Descreva em uma frase o que está contido nessa imagem
                
                Formatação: 
                  "Sim/Não; descrição"
                Exemplo: 
                a) "Não; Uma criança pequena está brincando com um cachorro em um parque."
                b) "Não; Uma paisagem com montanhas e um lago."
                c) "Sim; Duas mulheres estão caminhando juntas em uma praia ao pôr do sol."

                Observe que antes do ";" deve haver apenas "Sim" ou "Não", sem mais nada.
              `,
            },
            {
              inlineData: {
                mime_type: imageParts.mimeType,
                data: imageParts.data,
              },
            },
          ],
        },
      ],
    };

    // 3. Faz a chamada para a API do Gemini
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(
        "Erro na API do Google:",
        response.status,
        await response.text()
      );
      return 2; // erro
    }

    const data = await response.json();

    // 4. Extrai o texto da resposta
    if (!data.candidates || !data.candidates[0]?.content?.parts[0]?.text) {
      console.error("Formato de resposta inesperado da API:", data);
      return 2; // erro
    }
    const responseText = data.candidates[0].content.parts[0].text;
    console.log("background.js: Resposta da API:", responseText);

    // 5. Verifica se a resposta indica que há uma pessoa
    const shouldCensor = responseText.trim().toLowerCase().startsWith("sim");
    return shouldCensor ? 1 : 0; // 1 -> censurar; 0 -> ok
  } catch (error) {
    console.error("background.js: Erro ao processar a imagem:", error);
    return 2; // 2 -> erro
  }
}

// --- FUNÇÃO DE AJUDA PARA IMAGEM (VERSÃO DO SERVICE WORKER) ---

/**
 * Versão da sua função que funciona no Service Worker.
 * Usa fetch, createImageBitmap e OffscreenCanvas.
 */
const resizeImageAndConvertToBase64 = (
  imageUrl,
  maxWidth = 768,
  quality = 0.8
) => {
  return new Promise(async (resolve, reject) => {
    try {
      // 1. Busca a imagem (Isto só funciona por causa das 'host_permissions' no manifest)
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Falha ao buscar imagem: ${response.statusText}`);
      }
      const blob = await response.blob();

      // 2. Cria um ImageBitmap
      const imageBitmap = await createImageBitmap(blob);

      // 3. Calcula as novas dimensões
      const scale = maxWidth / imageBitmap.width;
      const newWidth = maxWidth;
      const newHeight = imageBitmap.height * scale;

      // 4. Usa OffscreenCanvas (próprio para workers)
      const canvas = new OffscreenCanvas(newWidth, newHeight);
      const ctx = canvas.getContext("2d");

      // 5. Desenha a imagem redimensionada
      ctx.drawImage(imageBitmap, 0, 0, newWidth, newHeight);

      // 6. Converte para Blob
      const resizedBlob = await canvas.convertToBlob({
        type: "image/jpeg",
        quality: quality,
      });

      // 7. Converte Blob para string base64
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          mimeType: "image/jpeg",
          data: reader.result.split(",")[1], // Pega apenas a parte base64
        });
      };
      reader.onerror = (err) => {
        reject(new Error("Falha ao converter blob para base64."));
      };
      reader.readAsDataURL(resizedBlob);
    } catch (err) {
      // Se falhar aqui (ex: "could not be decoded"), é um problema de fetch.
      reject(
        new Error(
          "Não foi possível carregar ou processar a imagem. Erro: " +
            err.message
        )
      );
    }
  });
};
