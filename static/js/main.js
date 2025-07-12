// In your JavaScript file (e.g., script.js or within a <script> tag at the end of your body)
document.addEventListener('DOMContentLoaded', function() {
    const navbarToggler = document.querySelector('.navbar-toggler');
    const navbarNav = document.querySelector('.navbar-nav');

    navbarToggler.addEventListener('click', function() {
        navbarNav.classList.toggle('show');
        navbarToggler.setAttribute('aria-expanded', navbarNav.classList.contains('show'));
    });
});
