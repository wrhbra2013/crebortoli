// Garante que o script só rode depois que a página carregar completamente
document.addEventListener('DOMContentLoaded', () => {

  // Seleciona o botão e o menu de navegação pelos seus nomes de classe
  const sandwichButton = document.querySelector('.sandwich-button');
  const mainNav = document.querySelector('.main-nav');

  // Verifica se ambos os elementos existem na página antes de continuar
  if (sandwichButton && mainNav) {
    
    // Adiciona um "ouvinte de evento" para o clique no botão
    sandwichButton.addEventListener('click', () => {
      
      // A mágica acontece aqui:
      // Adiciona ou remove a classe 'is-active' do menu de navegação
      mainNav.classList.toggle('is-active');

      // Atualiza o atributo 'aria-expanded' para acessibilidade (bom para leitores de tela)
      const isExpanded = sandwichButton.getAttribute('aria-expanded') === 'true';
      sandwichButton.setAttribute('aria-expanded', !isExpanded);
    });
  }
});