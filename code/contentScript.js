{
  let location = '' // guarda onde estamos no instagram (feed, stories, reels, ...)

  const checkInitialPosts = (location) => { // check the initial posts (before the page has been mutated) on the page (calls the necessary funcions for this)
    // Executa a função imediatamente para desfocar os posts que já estão na página.
    switch (location) {
      case '':  // feed
        const initialElements = [...document.querySelectorAll('img[alt^="Photo by"]'), ...document.querySelectorAll('img[alt^="Photo shared by"]')];
        initialElements.forEach(element => {
          checkElement(element, location);
        }); 
        break;

      case 'stories': 
        break;

      case 'reels': 
        break;

      case 'explore': 
        break;

      default: // não sabemos onde estamos
        break;
    }
  }

  const mutationHandler = (node, location) => { // handle with the new nodes that have shown up after page mutation
    switch (location) {
      case '':  // feed
          // Pega os filhos desse nó que sao posts
          let posts = [...node.querySelectorAll('img[alt^="Photo by"]'), ...node.querySelectorAll('img[alt^="Photo shared by"]')];
          // checa cada post se deve censurar
          posts.forEach(img => checkElement(img, location));
          break;

      case 'stories': 
          break;

      case 'reels': 
          break;

      case 'explore': 
          break;

      default: // não sabemos onde estamos
          break;
    }
  }

  const checkElement = (img, location) => { // check element and calls the front end funcions and the checkIfAdultization
    switch (location) {
      case '':  // feed
        const imageUrl = img.currentSrc // url da imagem atual
        showAnalysing(img, location);

        setTimeout(() => {

          removeAnalysing(img, location);

          if (checkIfAdultization(imageUrl)) { // checa se contem conteudo de sexualizacao
            // Censor
            showCensored(img, location);
          } else {
            // Not censored -> show that it was checked 
            showChecked(img, location);
          }
        }, 2000);
        break;

      case 'stories': 
        break;

      case 'reels': 
        break;

      case 'explore': 
        break;

      default: // não sabemos onde estamos
        break;
    }
  };

  const showAnalysing = (element, location) => { // the 'analyzing...' front end
    const parent = element.parentElement;
    if (!parent) return;

    // Evita adicionar múltiplos overlays de análise
    if (parent.querySelector('.analysing-container')) return;

    // Garante que o pai da imagem seja relativo para o posicionamento
    if (getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }

    // Aplica um blur inicial
    element.style.filter = 'blur(10px)';

    // Cria o container principal para o loading
    const analysingContainer = document.createElement('div');
    analysingContainer.className = 'analysing-container'; // Classe para poder remover depois
    analysingContainer.style.position = 'absolute';
    analysingContainer.style.top = '0';
    analysingContainer.style.left = '0';
    analysingContainer.style.width = '100%';
    analysingContainer.style.height = '100%';
    analysingContainer.style.pointerEvents = 'none';

    // Usa Flexbox para centralizar tudo
    analysingContainer.style.display = 'flex';
    analysingContainer.style.flexDirection = 'column'; // Organiza os itens em coluna (GIF em cima, texto embaixo)
    analysingContainer.style.justifyContent = 'center';
    analysingContainer.style.alignItems = 'center';

    // Cria o GIF de loading
    const loadingGif = document.createElement('img');
    loadingGif.src = chrome.runtime.getURL('images/loading.gif'); 
    loadingGif.style.width = '80px'; // Tamanho fixo para o GIF
    loadingGif.style.height = 'auto';
    loadingGif.style.filter = 'drop-shadow(0 0 4px #2896ff) drop-shadow(0 0 2px #2896ff)'

    // Cria o texto "Analisando..."
    const analysingText = document.createElement('div');
    analysingText.textContent = 'Analisando conteúdo...';
    analysingText.style.color = 'white';
    analysingText.style.marginTop = '10px';
    analysingText.style.fontSize = '1em';
    analysingText.style.fontWeight = 'bold';
    analysingText.style.textShadow = '0 0 5px black'; // Sombra para legibilidade

    // Monta o visual de análise
    analysingContainer.appendChild(loadingGif);
    analysingContainer.appendChild(analysingText);

    // Adiciona tudo à página
    parent.appendChild(analysingContainer);
  };

  const checkIfAdultization = (imageURL) => { // calls the computer vision analysis

    // on development 

    return false
  };

  const removeAnalysing = (element, location) => { // remove the 'analyzing...' front end after the image has been analyzed
    const parent = element.parentElement;
    if (!parent) return;
    
    // Remove o blur da imagem principal
    element.style.filter = '';

    // Encontra e remove o container de análise
    const analysisOverlay = parent.querySelector('.analysing-container');
    if (analysisOverlay) {
      parent.removeChild(analysisOverlay);
    }
  };

  const showCensored = (element, location) => { // show the censor front end if the image has been considered impropriate
    // Blur na imagem
    element.style.filter = 'blur(20px)';

    // Garante que o pai da imagem seja relativo
    const parent = element.parentElement;
    if (parent) {
      if (getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
      }
    }

    // Cria container do alerta
    const alertContainer = document.createElement('div');
    alertContainer.style.position = 'absolute';
    alertContainer.style.top = '0';
    alertContainer.style.left = '0';
    alertContainer.style.width = '100%';
    alertContainer.style.height = '100%';
    alertContainer.style.display = 'flex';
    alertContainer.style.flexDirection = 'column';
    alertContainer.style.justifyContent = 'center';
    alertContainer.style.alignItems = 'center';
    alertContainer.style.pointerEvents = 'none';

    // Símbolo
    const warningImage = document.createElement('img');
    warningImage.src = chrome.runtime.getURL('images/warning-sign.png');
    warningImage.style.width = '20%';
    warningImage.style.height = 'auto';
    warningImage.style.filter = 'drop-shadow(0 0 10px red)';
    // Texto
    const textContainer = document.createElement('div');
    textContainer.textContent = 'Essa imagem potencialmente sexualiza crianças';
    textContainer.style.color = 'red';
    textContainer.style.fontWeight = 'bold';
    textContainer.style.textAlign = 'center';
    textContainer.style.marginTop = '10px';
    textContainer.style.fontSize = '1.2em';
    textContainer.style.backgroundColor = 'rgba(86, 86, 86, 0.5)';
    textContainer.style.padding = '5px 10px';
    textContainer.style.borderRadius = '5px';

    // Monta a hierarquia
    alertContainer.appendChild(warningImage);
    alertContainer.appendChild(textContainer);
    parent.appendChild(alertContainer);
  };

  const showChecked = (element, location) => { // show the checkmark front end if the image has been considered safe

    const parent = element.parentElement;
    if (!parent) return; // Sai se não houver elemento pai

    // Verifica se a caixa já foi adicionada para evitar duplicatas
    if (parent.querySelector('.checked-box')) {
      return;
    }
    
    // Garante que o pai da imagem seja relativo para o posicionamento funcionar
    if (getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }

    // Cria o container principal da caixa
    const checkContainer = document.createElement('div');
    checkContainer.className = 'checked-box'; // Adiciona uma classe para evitar duplicatas
    checkContainer.style.position = 'absolute';
    checkContainer.style.top = '10px';
    checkContainer.style.right = '10px';
    checkContainer.style.backgroundColor = 'gray'; 
    checkContainer.style.opacity = '80%'
    checkContainer.style.color = 'white';
    checkContainer.style.padding = '5px 8px';
    checkContainer.style.borderRadius = '5px';
    checkContainer.style.fontSize = '12px';
    checkContainer.style.pointerEvents = 'none';

    // Usa Flexbox para alinhar texto e imagem
    checkContainer.style.display = 'flex';
    checkContainer.style.alignItems = 'center';

    // Cria o texto
    const textSpan = document.createElement('span');
    textSpan.textContent = 'Imagem sem identificação de crianças sexualizadas';
    
    // Cria o símbolo
    const checkImage = document.createElement('img');
    checkImage.src = chrome.runtime.getURL('images/checkmark.png'); // Use o nome correto do seu arquivo!
    checkImage.style.height = '1em'; // Faz a altura da imagem ser igual à altura da fonte
    checkImage.style.width = 'auto';
    checkImage.style.marginRight = '5px'; // Espaçamento entre o texto e o símbolo

    // Monta a caixa
    checkContainer.appendChild(checkImage);
    checkContainer.appendChild(textSpan);
    
    // Adiciona a caixa ao pai da imagem original
    parent.appendChild(checkContainer);
  };

  chrome.runtime.onMessage.addListener((message) => { 
    location = message; 
    checkInitialPosts(location);
  });

  // Cria um observador de mutação para lidar com o carregamento dinâmico de posts.
  const observer = new MutationObserver((mutations) => {
    // itera sob cada mutação da pagina
    mutations.forEach((mutation) => {
      // se a mutação é sobre a lista de filhos da pagina e o numero é positivo (foram adicionados nós)
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // itera sobre cada nó adicionado
        mutation.addedNodes.forEach(node => {
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
    subtree: true
  };
  // Inicia o observador.
  observer.observe(document.body, observerConfig);
}