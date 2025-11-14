console.log("testando se o background roda");

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // envia uma mensagem quando a aba é atualizada
  console.log("pagina atualizou");
  console.log("tab.url: ", tab.url);

  if (tab.url && tab.url.includes("https://www.instagram.com")) {
    // estamos no instagram
    let location = tab.url.split("instagram.com/")[1];
    location = location.split("/")[0]; // pegar a primeira palavra depois de 'https://www.instagram.com/' -> identifica onde no instagram estamos
    console.log("localizacao", location);
    chrome.tabs.sendMessage(tabId, location);
  }
});

const API_KEY = "API_KEY_HERE"; // substitua pela sua chave de API
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Ouve pela mensagem que já contém os dados da imagem
  if (request.type === "ANALYZE_IMAGE_DATA") {
    // Chama a função de análise, passando os dados da imagem
    performImageAnalysis(request.imageParts)
      .then((status) => {
        // Envia a resposta (0, 1, ou 2) de volta
        sendResponse({ status: status });
      })
      .catch((error) => {
        console.error("Erro no listener do background:", error);
        sendResponse({ status: 2 });
      });

    // Retorna true para resposta assíncrona
    return true;
  }
});

// --- LÓGICA DA API (SIMPLIFICADA) ---

/**
 * Função principal que executa a análise da imagem.
 * Agora ela recebe 'imageParts' diretamente.
 */
async function performImageAnalysis(imageParts) {
  try {
    // 1. A imagem já veio pronta do content script (imageParts).

    // 2. Monta o corpo (body) da requisição
    const body = {
      contents: [
        {
          parts: [
            {
              text: `
                Responda essas duas perguntas separado por ponto e vírgula (;):
                - "Sim", se a imagem contém pelo menos uma pessoa, e "Não", caso contrário.
                - Descreva em uma frase o que está contido nessa imagem
                
                Formatação: 
                  "Sim/Não; descrição"
                Exemplo: 
                a) "Sim; Uma criança pequena está brincando com um cachorro em um parque."
                b) "Não; Uma paisagem com montanhas e um lago."

                Observe que antes do ";" deve haver apenas "Sim" ou "Não", sem mais nada.
              `,
            },
            {
              // O nome correto do campo na API REST é 'inlineData' (camelCase)
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
      headers: {
        "Content-Type": "application/json",
      },
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
    console.log("Resposta da API:", responseText);

    // 5. Verifica se a resposta indica que há uma pessoa
    const shouldCensor = responseText.trim().toLowerCase().startsWith("sim");
    return shouldCensor ? 1 : 0; // 1 -> censurar; 0 -> ok
  } catch (error) {
    console.error("Erro ao processar a imagem no background:", error);
    return 2; // 2 -> erro
  }
}
