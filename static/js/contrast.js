// In script.js or a separate contrast.js
document.addEventListener('DOMContentLoaded', function() {
    const contrastButton = document.querySelector('.contrast-button');
    const body = document.body;
    const icon = document.querySelector('.contrast-icon');

    contrastButton.addEventListener('click', function() {
        body.classList.toggle('high-contrast');
        icon.style.backgroundColor = body.classList.contains('high-contrast') ? 
                                     getComputedStyle(body).getPropertyValue('--cor-texto') :
                                     getComputedStyle(body).getPropertyValue('--cor-fundo');
        icon.style.setProperty('--_icon-bg', body.classList.contains('high-contrast') ? 
                                     getComputedStyle(body).getPropertyValue('--cor-fundo') :
                                     getComputedStyle(body).getPropertyValue('--cor-texto'));
    });
});
