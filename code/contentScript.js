{
  let location = ""; // guarda onde estamos no instagram (feed, stories, reels, ...)

  // Cria a sidebar fixa na lateral
  const sidebar = document.createElement("div");
  sidebar.id = "detected-sidebar";
  sidebar.textContent = "Carregando...";
  document.body.appendChild(sidebar);

  const postsList = [];

  const checkInitialPosts = (location) => {
    // check the initial posts (before the page has been mutated) on the page (calls the necessary funcions for this)
    // Executa a função imediatamente para desfocar os posts que já estão na página.
    switch (location) {
      case "": // feed
        const initialElements = [
          ...document.querySelectorAll('img[alt^="Photo by"]'),
          ...document.querySelectorAll('img[alt^="Photo shared by"]'),
        ];
        initialElements.forEach((element) => {
          postsList.push(element);
          element.dataset.addToList = "true";
          analyzeImage(element, location);
        });
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

  const mutationHandler = (node, location) => {
    // handle with the new nodes that have shown up after page mutation
    switch (location) {
      case "": // feed
        // Pega os filhos desse nó que sao posts
        let posts = [
          ...node.querySelectorAll('img[alt^="Photo by"]'),
          ...node.querySelectorAll('img[alt^="Photo shared by"]'),
        ];
        // checa cada post se deve censurar
        posts.forEach((img) => {
          if (!img.dataset.addToList) {
            postsList.push(img);
            img.dataset.addToList = "true";
            analyzeImage(img, location);
          }
        });
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

  const analyzeImage = async (img, location) => {
    // check element and calls the front end funcions and the checkIfAdultization
    // Verifica se a imagem já foi ou está sendo analisada. Se sim, para a execução.
    if (img.dataset.detectedObjects) {
      return;
    }

    // Marca a imagem como "analisando" para evitar que seja processada novamente.
    img.dataset.detectedObjects = "pending";

    switch (location) {
      case "": // feed
        const imageUrl = img.src; // url da imagem atual
        showAnalysing(img, location);

        const objects = await getObjectsOnImage(imageUrl); // analise e pega os objetos presentes na imagem
        img.dataset.detectedObjects = JSON.stringify(objects); // guarda os objetos como uma propriedade do elemento
        removeAnalysing(img, ""); // remove o front end de analisando
        drawBoxesOnImage(img, ""); // desenha bounding boxes na imagem
        updateSidebar();
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

  const showAnalysing = (element, location) => {
    // the 'analyzing...' front end
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
    analysingContainer.className = "analysing-container"; // Classe para poder remover depois
    analysingContainer.style.position = "absolute";
    analysingContainer.style.top = "0";
    analysingContainer.style.left = "0";
    analysingContainer.style.width = "100%";
    analysingContainer.style.height = "100%";
    analysingContainer.style.pointerEvents = "none";

    // Usa Flexbox para centralizar tudo
    analysingContainer.style.display = "flex";
    analysingContainer.style.flexDirection = "column"; // Organiza os itens em coluna (GIF em cima, texto embaixo)
    analysingContainer.style.justifyContent = "center";
    analysingContainer.style.alignItems = "center";

    // Cria o GIF de loading
    const loadingGif = document.createElement("img");
    loadingGif.src = chrome.runtime.getURL("images/loading.gif");
    loadingGif.style.width = "80px"; // Tamanho fixo para o GIF
    loadingGif.style.height = "auto";
    loadingGif.style.filter =
      "drop-shadow(0 0 4px #2896ff) drop-shadow(0 0 2px #2896ff)";

    // Cria o texto "Analisando..."
    const analysingText = document.createElement("div");
    analysingText.textContent = "Analisando conteúdo...";
    analysingText.style.color = "white";
    analysingText.style.marginTop = "10px";
    analysingText.style.fontSize = "1em";
    analysingText.style.fontWeight = "bold";
    analysingText.style.textShadow = "0 0 5px black"; // Sombra para legibilidade

    // Monta o visual de análise
    analysingContainer.appendChild(loadingGif);
    analysingContainer.appendChild(analysingText);

    // Adiciona tudo à página
    parent.appendChild(analysingContainer);
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
    alertContainer.style.position = "absolute";
    alertContainer.style.top = "0";
    alertContainer.style.left = "0";
    alertContainer.style.width = "100%";
    alertContainer.style.height = "100%";
    alertContainer.style.display = "flex";
    alertContainer.style.flexDirection = "column";
    alertContainer.style.justifyContent = "center";
    alertContainer.style.alignItems = "center";
    alertContainer.style.pointerEvents = "none";

    // Símbolo
    const warningImage = document.createElement("img");
    warningImage.src = chrome.runtime.getURL("images/error.svg");
    warningImage.style.width = "20%";
    warningImage.style.height = "auto";
    warningImage.style.filter = "drop-shadow(0 0 10px yellow)";
    // Texto
    const textContainer = document.createElement("div");
    textContainer.textContent = "Erro ao analisar imagem";
    textContainer.style.color = "yellow";
    textContainer.style.fontWeight = "bold";
    textContainer.style.textAlign = "center";
    textContainer.style.marginTop = "10px";
    textContainer.style.fontSize = "1.2em";
    textContainer.style.backgroundColor = "rgba(86, 86, 86, 0.5)";
    textContainer.style.padding = "5px 10px";
    textContainer.style.borderRadius = "5px";

    // Monta a hierarquia
    alertContainer.appendChild(warningImage);
    alertContainer.appendChild(textContainer);
    parent.appendChild(alertContainer);
  };

  const HF_TOKEN = "hf_XXXXXXXXXXXXXXXXXXX";

  const getObjectsOnImage = async (imageUrl) => {
    // detect the objects on image - call api
    const response = await fetch(
      "https://api-inference.huggingface.co/models/facebook/detr-resnet-50",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: imageUrl }),
      }
    );

    let result = await response.json();
    if (Array.isArray(result)) {
      // return result.map((r) => r.label);
      result = result.filter((object) => object.score >= 0.9);
      console.log("image", imageUrl, "analysis", result);
      return result;
    } else {
      console.log("Erro na detecção:", result);
    }
  };

  const drawBoxesOnImage = (img, location) => {
    const objects = JSON.parse(img.dataset.detectedObjects);

    console.log("objects", objects);
    const typeObjects = objects.map((obj) => obj.label);
    console.log("types", typeObjects);
    const colors = [];
    for (let i = 0; i < objects.length; i++) {
      const hue = i * (360 / objects.length);
      colors.push(hue);
    }

    const parent = img.parentElement;
    parent.style.position = "relative";

    const naturalWidth = img.naturalWidth; // tamanho original da imagem
    const naturalHeight = img.naturalHeight;
    const displayWidth = img.width; // tamanho no DOM
    const displayHeight = img.height;

    const scaleX = displayWidth / naturalWidth;
    const scaleY = displayHeight / naturalHeight;

    objects.forEach((obj, i) => {
      const { label, box, score } = obj;

      // reescala coordenadas
      const x = box.xmin * scaleX;
      const y = box.ymin * scaleY;
      const w = (box.xmax - box.xmin) * scaleX;
      const h = (box.ymax - box.ymin) * scaleY;

      const boxEl = document.createElement("div");
      boxEl.style.position = "absolute";
      boxEl.style.left = `${x}px`;
      boxEl.style.top = `${y}px`;
      boxEl.style.width = `${w}px`;
      boxEl.style.height = `${h}px`;
      boxEl.style.border = `10px solid hsla(${colors[i]}, 100%, 50%, 0.8)`;
      boxEl.style.pointerEvents = "none";
      boxEl.className = "objectBox";

      const labelEl = document.createElement("div");
      labelEl.innerText = `${label} (${(score * 100).toFixed(1)}%)`;
      labelEl.style.position = "absolute";
      labelEl.style.left = "0";
      // labelEl.style.top = "-18px";
      labelEl.style.background = `hsla(${colors[i]}, 100%, 50%, 0.7)`;
      labelEl.style.color = "white";
      labelEl.style.fontSize = "12px";
      labelEl.style.padding = "2px 4px";
      labelEl.style.borderRadius = "4px";
      labelEl.className = "objectLabel";

      boxEl.appendChild(labelEl);
      parent.appendChild(boxEl);
    });
  };

  const getImageAtCenter = () => {
    const viewportCenterY = window.innerHeight / 2;
    const viewportCenterX = window.innerWidth / 2;

    for (const img of postsList) {
      const rect = img.getBoundingClientRect();
      if (
        rect.top < viewportCenterY &&
        rect.bottom > viewportCenterY &&
        rect.left < viewportCenterX &&
        rect.right > viewportCenterX
      ) {
        console.log("image on center", img);
        return img; // retorn the image that is in the center of the screen
      }
    }
  };

  const updateSidebar = () => {
    try {
      const centerImg = getImageAtCenter(); // pick the image in the center of the screen
      console.log("imagem no centro", centerImg);
      const objects = JSON.parse(centerImg.dataset.detectedObjects);
      const typeObjects = objects.map((obj) => obj.label);
      console.log("center image objects", typeObjects);
      const colors = [];
      for (let i = 0; i < objects.length; i++) {
        const hue = i * (360 / objects.length);
        colors.push(hue);
      }
      if (centerImg && typeObjects) {
        sidebar.innerHTML = "";
        typeObjects.forEach((obj, i) => {
          // updates the sidebar content to use the objects of the center image
          const element = document.createElement("p");
          element.textContent = obj;
          sidebar.appendChild(element);
          element.style.color = `hsl(${colors[i]}, 100%, 50%)`;
        });
      } else {
        throw new Error("Without image on center or image without objects");
      }
    } catch (error) {
      console.error(error);
      sidebar.textContent = "Sem objetos";
    }
  };

  window.addEventListener("scroll", updateSidebar);
  window.addEventListener("load", updateSidebar);

  chrome.runtime.onMessage.addListener((message) => {
    location = message;
    checkInitialPosts(location);
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
            mutationHandler(node, location); // calls the handler (considering where we are on instagram)
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
