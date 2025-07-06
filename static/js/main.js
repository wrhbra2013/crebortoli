 document.addEventListener('DOMContentLoaded', () => {
     // Seleciona o botão e o menu de navegação
     const sandwichButton = document.querySelector('.sandwich-button');
     const mainNav = document.querySelector('.main-nav');
 
     // Verifica se ambos os elementos existem na página
     if (sandwichButton && mainNav) {
         
         // Adiciona um "ouvinte" para o evento de clique no botão
         sandwichButton.addEventListener('click', () => {
             // Adiciona ou remove a classe 'is-active' do botão
             sandwichButton.classList.toggle('is-active');
             
             // Adiciona ou remove a classe 'is-active' do menu
             mainNav.classList.toggle('is-active');
 
             // Atualiza o atributo aria-expanded para acessibilidade
             const isExpanded = sandwichButton.getAttribute('aria-expanded') === 'true';
             sandwichButton.setAttribute('aria-expanded', !isExpanded);
         });
     }
 });
 