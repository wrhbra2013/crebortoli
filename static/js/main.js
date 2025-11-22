document.addEventListener('DOMContentLoaded', function () {
    const sandwichButton = document.querySelector('.sandwich-button');
    const mainNav = document.querySelector('.main-nav');

    // 1. Toggle para o menu principal (sandwich)
    if (sandwichButton && mainNav) {
        sandwichButton.addEventListener('click', () => {
            sandwichButton.classList.toggle('is-active');
            mainNav.classList.toggle('is-active');
        });
    }

    // 2. Lógica para os submenus (dropdowns) no mobile
    const dropdownToggles = document.querySelectorAll('.main-nav .dropdown-toggle');

    dropdownToggles.forEach(toggle => {
        toggle.addEventListener('click', function (event) {
            // Apenas executa a lógica de abrir/fechar em telas mobile
            if (window.innerWidth <= 768) {
                // Previne o link de navegar para '#'
                event.preventDefault();

                const parentLi = this.closest('.dropdown');
                const dropdownMenu = parentLi.querySelector('.dropdown-menu');

                // Fecha outros submenus abertos para evitar poluição visual
                document.querySelectorAll('.main-nav .dropdown-menu.show').forEach(openMenu => {
                    if (openMenu !== dropdownMenu) {
                        openMenu.classList.remove('show');
                        openMenu.closest('.dropdown').classList.remove('show');
                    }
                });

                // Abre ou fecha o submenu atual
                if (parentLi && dropdownMenu) {
                    parentLi.classList.toggle('show');
                    dropdownMenu.classList.toggle('show');
                }
            }
        });
    });

    // Opcional: Fechar o menu se clicar fora dele
    document.addEventListener('click', function(event) {
        if (mainNav.classList.contains('is-active') && !mainNav.contains(event.target) && !sandwichButton.contains(event.target)) {
            mainNav.classList.remove('is-active');
            sandwichButton.classList.remove('is-active');
        }
    });
});