// 1. IMPORTAÇÃO DO ARQUIVO DE CONFIGURAÇÃO SECRETO
import { API_CONFIG } from "./config.js";

if (!API_CONFIG) {
  throw new Error("Arquivo config.js não foi encontrado ou está inválido.");
} else if (
  !API_CONFIG.GOOGLE_API_KEY ||
  !API_CONFIG.GROQ_API_KEY ||
  !API_CONFIG.SYSTEM_PROMPT ||
  !API_CONFIG.PROMPT ||
  API_CONFIG.MODEL_TEMPERATURE === undefined ||
  !API_CONFIG.AI_PROVIDER
) {
  throw new Error("Configurações de API estão faltando no config.js.");
} else {
  console.log("Rodando com o provedor :", API_CONFIG.AI_PROVIDER);
}

console.log("background.js: Service Worker iniciado.");

// --- CONFIGURAÇÕES E CHAVES ---
const GOOGLE_API_KEY = API_CONFIG.GOOGLE_API_KEY;
const GROQ_API_KEY = API_CONFIG.GROQ_API_KEY;
const AI_PROVIDER = API_CONFIG.AI_PROVIDER;
const GROQ_AI_MODEL = API_CONFIG.GROQ_AI_MODEL;
const SYSTEM_PROMPT = API_CONFIG.SYSTEM_PROMPT;
const PROMPT = API_CONFIG.PROMPT;
const MODEL_TEMPERATURE = API_CONFIG.MODEL_TEMPERATURE;

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

// --- OUVINTE DE MENSAGENS ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 👇 Ouvindo pela mensagem correta do contentScript
  if (request.type === "ANALYZE_IMAGE_URL") {
    console.log("background.js: Recebido ANALYZE_IMAGE_URL para:", request.url);

    // Chama a função de análise, passando a URL
    performImageAnalysis(request.url, AI_PROVIDER)
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
 * Função Orquestradora: Prepara a imagem e delega para a API escolhida.
 */
async function performImageAnalysis(imageURL, provider) {
  try {
    // 1. Converte a URL da imagem para base64
    const imageParts = await resizeImageAndConvertToBase64(imageURL, 768, 0.8);

    // 2. Chama a função genérica de API
    const responseText = await callAIProvider(provider, imageParts);

    console.log(`background.js: Resposta da API (${provider}):`, responseText);

    // 3. Verifica resposta para decidir censura
    const shouldCensor = responseText.trim().toLowerCase().startsWith("sim");
    return shouldCensor ? 1 : 0;
  } catch (error) {
    console.error("background.js: Erro crítico na análise:", error);
    return 2; // erro
  }
}

// --- FUNÇÃO QUE GERENCIA A CHAMADA PARA CADA API ---
async function callAIProvider(provider, imageParts) {
  let url, options;

  // 1. A partir do provedor, configura url e opções para o fetch
  if (provider === "google") {
    // --- CONFIGURAÇÃO GEMINI ---
    url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`;

    const body = {
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          parts: [
            { text: PROMPT },
            {
              inlineData: {
                mime_type: imageParts.mimeType,
                data: imageParts.data,
              },
            },
          ],
        },
      ],
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_NONE",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_NONE",
        },
      ],
      generationConfig: { temperature: MODEL_TEMPERATURE },
    };

    options = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    };
  } else if (provider === "groq") {
    // --- CONFIGURAÇÃO GROQ ---
    url = "https://api.groq.com/openai/v1/chat/completions";

    const body = {
      model: GROQ_AI_MODEL,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            {
              type: "image_url",
              image_url: {
                url: `data:${imageParts.mimeType};base64,${imageParts.data}`,
              },
            },
          ],
        },
      ],
      temperature: MODEL_TEMPERATURE,
      stream: false,
    };

    options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify(body),
    };
  } else {
    throw new Error("Provedor de IA inválido: " + provider);
  }

  // 2. Executa fetch
  const response = await fetch(url, options);

  if (!response.ok) {
    // Se deu erro, identifica se foi um erro de conteúdo proibido
    const errorText = await response.text();
    if (errorText.includes("PROHIBITED_CONTENT")) {
      return "Sim; Conteúdo Proibido (Capturado via HTTP Error).";
    }
    throw new Error(
      `Erro na API ${provider}: ${response.status} - ${errorText}`
    );
  }

  // 3. A partir da resposta em json, extrai o texto conforme o provedor
  const data = await response.json();
  if (provider === "google") {
    if (data.promptFeedback?.blockReason) {
      return `Sim; Bloqueado pelo filtro de Prompt (${data.promptFeedback.blockReason}).`;
    }

    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      const finishReason = candidate.finishReason;

      if (finishReason === "PROHIBITED_CONTENT") {
        return "Sim; Conteúdo Proibido detectado (FinishReason: PROHIBITED_CONTENT).";
      }

      if (finishReason === "SAFETY") {
        return "Sim; Conteúdo Inseguro detectado (FinishReason: SAFETY).";
      }

      if (candidate.content?.parts?.[0]?.text) {
        return candidate.content.parts[0].text;
      } else {
        return "Sim; Bloqueio silencioso ou resposta vazia.";
      }
    } else {
      throw new Error("Resposta inválida Gemini");
    }
  } else if (provider === "groq") {
    if (!data.choices?.[0]?.message?.content)
      throw new Error("Resposta inválida Groq");
    return data.choices[0].message.content;
  }
}

// --- FUNÇÃO DE AJUDA PARA IMAGEM (OFFSCREENCANVAS) ---
const resizeImageAndConvertToBase64 = (
  imageUrl,
  maxWidth = 768,
  quality = 0.8
) => {
  return new Promise(async (resolve, reject) => {
    try {
      // 1. Busca a imagem
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

      // 4. Usa OffscreenCanvas
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
      reject(new Error("Erro processando imagem: " + err.message));
    }
  });
};
