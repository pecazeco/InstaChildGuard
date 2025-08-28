console.log('testando se o background roda')
        
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => { // envia uma mensagem quando a aba é atualizada 
    console.log('pagina atualizou');
    console.log('tab.url: ', tab.url);

    if (tab.url && tab.url.includes('https://www.instagram.com')) { // estamos no instagram
        let location = tab.url.split('instagram.com/')[1] 
        location = location.split('/')[0] // pegar a primeira palavra depois de 'https://www.instagram.com/' -> identifica onde no instagram estamos
        console.log('localizacao', location);
        chrome.tabs.sendMessage( tabId, location);
    }
});
