// Espera o documento HTML ser completamente carregado antes de executar o script
document.addEventListener('DOMContentLoaded', function() {
    
    // Seleciona o botão do menu e o menu de navegação
    const sandwichButton = document.querySelector('.sandwich-button');
    const navMenu = document.querySelector('.main-nav');

    // Verifica se ambos os elementos existem na página
    if (sandwichButton && navMenu) {
        // Adiciona um "ouvinte" de clique ao botão
        sandwichButton.addEventListener('click', function() {
            // Alterna a classe 'is-active' no menu
            // Isso vai mostrar ou esconder o menu
            navMenu.classList.toggle('is-active');
        });
    }

});
