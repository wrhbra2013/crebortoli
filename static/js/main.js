function initMenu() {
    const sandwichButton = document.getElementById('menu-toggle') || document.querySelector('.sandwich-button');
    const mainNav = document.getElementById('main-navigation') || document.querySelector('.main-nav');
    const mobileOverlay = document.getElementById('mobile-overlay');

    // 1. Toggle para o menu principal (sandwich)
    if (sandwichButton && mainNav) {
        sandwichButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const isActive = sandwichButton.classList.toggle('is-active');
            mainNav.classList.toggle('is-active');
            if (mobileOverlay) mobileOverlay.classList.toggle('is-active');
            sandwichButton.setAttribute('aria-expanded', isActive);
        });
    }

    // Fechar menu ao clicar no overlay
    if (mobileOverlay) {
        mobileOverlay.addEventListener('click', () => {
            mainNav.classList.remove('is-active');
            sandwichButton.classList.remove('is-active');
            mobileOverlay.classList.remove('is-active');
            sandwichButton.setAttribute('aria-expanded', 'false');
        });
    }

    // 2. Lógica para os submenus (dropdowns) no mobile
    const dropdownToggles = document.querySelectorAll('.main-nav .dropdown-toggle');

    dropdownToggles.forEach(toggle => {
        toggle.addEventListener('click', function (event) {
            if (window.innerWidth <= 768) {
                event.preventDefault();
                const parentLi = this.closest('.dropdown');
                const dropdownMenu = parentLi.querySelector('.dropdown-menu');

                document.querySelectorAll('.main-nav .dropdown-menu.show').forEach(openMenu => {
                    if (openMenu !== dropdownMenu) {
                        openMenu.classList.remove('show');
                        openMenu.closest('.dropdown').classList.remove('show');
                    }
                });

                if (parentLi && dropdownMenu) {
                    parentLi.classList.toggle('show');
                    dropdownMenu.classList.toggle('show');
                }
            }
        });
    });

    // Fechar o menu se clicar fora dele
    document.addEventListener('click', function(event) {
        if (mainNav && mainNav.classList.contains('is-active') && !mainNav.contains(event.target) && !sandwichButton.contains(event.target)) {
            mainNav.classList.remove('is-active');
            sandwichButton.classList.remove('is-active');
            sandwichButton.setAttribute('aria-expanded', 'false');
            if (mobileOverlay) mobileOverlay.classList.remove('is-active');
        }
    });
}

document.addEventListener('DOMContentLoaded', initMenu);