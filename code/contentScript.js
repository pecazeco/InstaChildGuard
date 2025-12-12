{
  let location = ""; // guarda onde estamos no instagram (feed, stories, reels, ...)

  const checkEachPost = (node, location) => {
    switch (location) {
      case "": // feed
        // Pega os filhos desse nó que sao posts
        let posts = [
          ...node.querySelectorAll('img[alt^="Photo by"]'),
          ...node.querySelectorAll('img[alt^="Photo shared by"]'),
        ];
        // checa cada post se deve censurar
        posts.forEach((img) => checkElement(img, location));
        break;

      case "stories":
        break;

      case "reels":
        break;

      case "explore":
        break;

      default: // não sabemos onde estamos
        break;
    }
  };

  /**
   * 'checkElement' (O Despachante)
   * Verifica se uma imagem está pronta para ser processada.
   * Se estiver, chama processImage().
   * Se não estiver, adiciona um ouvinte 'load'.
   */
  const checkElement = (img, location) => {
    // Evita processar a mesma imagem múltiplas vezes
    if (img.dataset.analysisState) {
      return;
    }

    // Marca a imagem como "analisando" para evitar que seja processada novamente.
    img.dataset.analysisState = "pending";
    console.log("Observado:", img);

    // 3. Verifica se a imagem já está carregada (ex: posts iniciais)
    // 'complete' = o browser terminou de carregar
    // 'currentSrc' = tem uma fonte de imagem válida
    if (img.complete && img.currentSrc) {
      console.log(
        "Imagem já carregada, processando imediatamente:",
        img.currentSrc
      );
      processImage(img, location); // Processa agora
    } else {
      // 4. Imagem é nova. Temos de esperar que ela carregue.
      console.log("Imagem nova, aguardando 'load' event:", img.src);

      const onLoad = () => {
        console.log("'load' event disparado, processando:", img.currentSrc);
        processImage(img, location);
        // Limpa os ouvintes
        img.removeEventListener("load", onLoad);
        img.removeEventListener("error", onError);
      };

      const onError = () => {
        console.error(
          "Erro ao carregar imagem no DOM (src pode estar inválido):",
          img.src
        );
        img.dataset.analysisState = "error";
        showError(img, location); // Mostra o erro visual
        // Limpa os ouvintes
        img.removeEventListener("load", onLoad);
        img.removeEventListener("error", onError);
      };

      img.addEventListener("load", onLoad);
      img.addEventListener("error", onError);
    }
  };

  const processImage = async (img, location) => {
    let startTime = Date.now();

    // Atualiza o estado
    img.dataset.analysisState = "processing";

    switch (location) {
      case "": // feed
        const imageUrl = img.currentSrc;

        // Uma verificação de segurança final
        if (!imageUrl) {
          console.error(
            "processImage foi chamado mas currentSrc está vazio.",
            img
          );
          img.dataset.analysisState = "error";
          showError(img, location);
          return;
        }

        showAnalysing(img, location);
        console.log("Analisando o elemento:", imageUrl);

        const response = await checkIfAdultization(imageUrl);

        img.dataset.analysisState = "complete";
        removeAnalysing(img, location);

        switch (response) {
          case 0:
            showChecked(img, location);
            break;
          case 1:
            showCensored(img, location);
            break;
          case 2:
            showError(img, location);
            break;
          default:
            break;
        }
        break;

      case "stories":
        break;
    }

    const elapsedTime = Date.now() - startTime;
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    if (elapsedTime < 10000) {
      await delay(10000 - elapsedTime);
      return;
    }
  };

  const showAnalysing = (element, location) => {
    const parent = element.parentElement;
    if (!parent) return;

    // Evita adicionar múltiplos overlays de análise
    if (parent.querySelector(".analysing-container")) return;

    // Garante que o pai da imagem seja relativo para o posicionamento
    if (getComputedStyle(parent).position === "static") {
      parent.style.position = "relative";
    }

    // Aplica um blur inicial
    element.style.filter = "blur(10px)";
    // Cria o container principal para o loading
    const analysingContainer = document.createElement("div");
    analysingContainer.className = "analysing-container";
    // Cria o GIF de loading
    const loadingGif = document.createElement("img");
    loadingGif.src = chrome.runtime.getURL("images/loading.gif");
    loadingGif.className = "analysing-gif";
    // Cria o texto "Analisando..."
    const analysingText = document.createElement("div");
    analysingText.textContent = "Analisando conteúdo...";
    analysingText.className = "analysing-text";
    // Monta o visual de análise
    analysingContainer.appendChild(loadingGif);
    analysingContainer.appendChild(analysingText);
    // Adiciona tudo à página
    parent.appendChild(analysingContainer);
  };

  const checkIfAdultization = async (imageURL) => {
    try {
      // 1. Envia a URL para o background
      const response = await chrome.runtime.sendMessage({
        type: "ANALYZE_IMAGE_URL", // Assegure-se que o background ouve por este tipo
        url: imageURL,
      });

      // 2. Processa a resposta do background
      if (response && typeof response.status === "number") {
        return response.status; // Retorna o status (0, 1, ou 2)
      } else {
        console.error("Resposta inválida do background script:", response);
        return 2; // Erro
      }
    } catch (error) {
      console.error(
        "Erro ao enviar mensagem para o background:",
        error.message
      );
      return 2; // Erro
    }
  };

  const removeAnalysing = (element, location) => {
    // remove the 'analyzing...' front end after the image has been analyzed
    const parent = element.parentElement;
    if (!parent) return;
    // Remove o blur da imagem principal
    element.style.filter = "";
    // Encontra e remove o container de análise
    const analysisOverlay = parent.querySelector(".analysing-container");
    if (analysisOverlay) {
      parent.removeChild(analysisOverlay);
    }
  };

  const showCensored = (element, location) => {
    // show the censor front end if the image has been considered impropriate
    // Blur na imagem
    element.style.filter = "blur(20px)";

    // Garante que o pai da imagem seja relativo
    const parent = element.parentElement;
    if (parent) {
      if (getComputedStyle(parent).position === "static") {
        parent.style.position = "relative";
      }
    }

    // Cria container do alerta
    const alertContainer = document.createElement("div");
    alertContainer.className = "censor-container";
    // Símbolo
    const warningImage = document.createElement("img");
    warningImage.src = chrome.runtime.getURL("images/warning-sign.png");
    warningImage.className = "censor-image";
    // Texto
    const alertText = document.createElement("div");
    alertText.className = "censor-text";
    alertText.textContent = "Essa imagem potencialmente sexualiza crianças";
    // Monta a hierarquia
    alertContainer.appendChild(warningImage);
    alertContainer.appendChild(alertText);
    parent.appendChild(alertContainer);
  };

  const showError = (element, location) => {
    // show the error front end if that was any error while analyzing
    // Blur na imagem
    element.style.filter = "blur(20px)";

    // Garante que o pai da imagem seja relativo
    const parent = element.parentElement;
    if (parent) {
      if (getComputedStyle(parent).position === "static") {
        parent.style.position = "relative";
      }
    }

    // Cria container do alerta
    const alertContainer = document.createElement("div");
    alertContainer.className = "error-container";
    // Símbolo
    const warningImage = document.createElement("img");
    warningImage.src = chrome.runtime.getURL("images/error.svg");
    warningImage.className = "error-image";
    // Texto
    const alertText = document.createElement("div");
    alertText.className = "error-text";
    alertText.textContent = "Erro ao analisar imagem";
    // Monta a hierarquia
    alertContainer.appendChild(warningImage);
    alertContainer.appendChild(alertText);
    parent.appendChild(alertContainer);
  };

  const showChecked = (element, location) => {
    const parent = element.parentElement;
    if (!parent) return; // Sai se não houver elemento pai

    // Verifica se a caixa já foi adicionada para evitar duplicatas
    if (parent.querySelector(".checked-box")) return;

    // Garante que o pai da imagem seja relativo para o posicionamento funcionar
    if (getComputedStyle(parent).position === "static") {
      parent.style.position = "relative";
    }

    // Cria o container principal da caixa
    const checkContainer = document.createElement("div");
    checkContainer.className = "checked-box"; // Adiciona uma classe para evitar duplicatas
    // Cria o texto
    const textSpan = document.createElement("span");
    textSpan.textContent = "Imagem sem identificação de crianças sexualizadas";
    // Cria o símbolo
    const checkImage = document.createElement("img");
    checkImage.src = chrome.runtime.getURL("images/checkmark.png"); // Use o nome correto do seu arquivo!
    checkImage.className = "checkmark-image";
    // Monta a caixa
    checkContainer.appendChild(checkImage);
    checkContainer.appendChild(textSpan);
    // Adiciona a caixa ao pai da imagem original
    parent.appendChild(checkContainer);
  };

  chrome.runtime.onMessage.addListener((message) => {
    location = message;
    checkEachPost(document, location);
  });

  // Cria um observador de mutação para lidar com o carregamento dinâmico de posts.
  const observer = new MutationObserver((mutations) => {
    // itera sob cada mutação da pagina
    mutations.forEach((mutation) => {
      // se a mutação é sobre a lista de filhos da pagina e o numero é positivo (foram adicionados nós)
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        // itera sobre cada nó adicionado
        mutation.addedNodes.forEach((node) => {
          // Verifica se o nó adicionado é um elemento HTML
          if (node.nodeType === 1) {
            checkEachPost(node, location); // checa os posts dentro desse nó
          }
        });
      }
    });
  });
  // Configuração do observador: monitorar mudanças na lista de filhos do corpo da página.
  const observerConfig = {
    childList: true,
    subtree: true,
  };
  // Inicia o observador.
  observer.observe(document.body, observerConfig);
}
