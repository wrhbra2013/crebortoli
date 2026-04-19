function getBasePath() {
    const path = window.location.pathname;
    if (path === '/' || path.endsWith('/index.html') || path === '/index.html') {
        return './';
    }
    const pathWithoutFile = path.replace(/\/[^/]*$/, '');
    const depth = pathWithoutFile.split('/').filter(p => p).length;
    if (depth === 0) return './';
    if (path.includes('/sig/')) {
        return '../';
    }
    if (path.includes('/paginas/')) {
        return '../';
    }
    return './';
}

function getSigPath() {
    const path = window.location.pathname;
    if (path.includes('/paginas/')) {
        return '../sig/';
    }
    if (path.includes('/sig/')) {
        return './';
    }
    return 'sig/';
}

function getStaticPath() {
    return getBasePath() + 'static/';
}

function initComponents() {
    const staticPath = getStaticPath();
    
    const headerHTML = `<header class="header">
    <div class="header-container">
        <a href="${getBasePath()}index.html" class="header-title">
            <span class="site-title">crebortoli</span>
        </a>
        <button id="menu-toggle" class="sandwich-button" aria-label="Abrir menu" aria-expanded="false">
            <span></span>
            <span></span>
            <span></span>
        </button>
    </div>
    <nav id="main-navigation" class="main-nav">
        <ul class="menu">
            <li class="nav-item"><a class="nav-link" href="${getBasePath()}index.html">Home</a></li>
            <li class="nav-item"><a class="nav-link" href="${getBasePath()}paginas/servicos.html">Serviços</a></li>
            <li class="nav-item"><a class="nav-link" href="${getBasePath()}paginas/agenda.html">Agenda</a></li>
            <li class="nav-item"><a class="nav-link" href="${getBasePath()}paginas/pagamento.html">Pagamento</a></li>
            <li class="nav-item"><a class="nav-link" href="${getBasePath()}paginas/sobre.html">Sobre</a></li>
            <li class="nav-item"><a class="nav-link" href="${getBasePath()}paginas/contato.html">Contato</a></li>
            <li class="nav-item"><a class="nav-link" href="${getSigPath()}index.html">Admin</a></li>
        </ul>
    </nav>
</header>
<div class="mobile-overlay" id="mobile-overlay"></div>`;

    const headerSigHTML = `<header class="header">
    <div class="header-container">
        <a href="${getSigPath()}index.html" class="header-title">
            <span class="site-title">crebortoli</span>
        </a>
        <button id="menu-toggle" class="sandwich-button" aria-label="Abrir menu" aria-expanded="false">
            <span></span>
            <span></span>
            <span></span>
        </button>
    </div>
    <nav id="main-navigation" class="main-nav">
        <ul class="menu">
            <li class="nav-item"><a class="nav-link" href="${getSigPath()}index.html">Dashboard</a></li>
            <li class="nav-item"><a class="nav-link" href="${getSigPath()}agenda.html">Agenda</a></li>
            <li class="nav-item"><a class="nav-link" href="${getSigPath()}tabela_precos.html">Tabela de Preços</a></li>
            <li class="nav-item"><a class="nav-link" href="${getSigPath()}relatorios.html">Relatórios</a></li>
            <li class="nav-item"><a class="nav-link" href="${getBasePath()}index.html">Ver Site</a></li>
            <li class="nav-item"><a class="nav-link" href="javascript:logout()" style="color:#e91e63;">Sair</a></li>
        </ul>
    </nav>
</header>
<div class="mobile-overlay" id="mobile-overlay"></div>`;

    const footerHTML = `<footer class="footer">
    <p>&copy; 2026 Cre Bortoli. Todos os direitos reservados.</p>
</footer>`;

    const isSigPage = window.location.pathname.includes('/sig/') || window.location.pathname.endsWith('sig/index.html');
    
    document.getElementById('header-placeholder').innerHTML = isSigPage ? headerSigHTML : headerHTML;
    document.getElementById('footer-placeholder').innerHTML = footerHTML;
    
    initMenu();
}

function initMenu() {
    const menuToggle = document.getElementById('menu-toggle');
    const mainNav = document.getElementById('main-navigation');
    const mobileOverlay = document.getElementById('mobile-overlay');
    
    if (!menuToggle || !mainNav) return;
    
    function openMenu() {
        mainNav.classList.add('is-active');
        menuToggle.classList.add('is-active');
        menuToggle.setAttribute('aria-expanded', 'true');
        if (mobileOverlay) mobileOverlay.classList.add('is-active');
        document.body.classList.add('menu-open');
    }
    
    function closeMenu() {
        mainNav.classList.remove('is-active');
        menuToggle.classList.remove('is-active');
        menuToggle.setAttribute('aria-expanded', 'false');
        if (mobileOverlay) mobileOverlay.classList.remove('is-active');
        document.body.classList.remove('menu-open');
    }
    
    menuToggle.addEventListener('click', function() {
        if (mainNav.classList.contains('is-active')) {
            closeMenu();
        } else {
            openMenu();
        }
    });

    if (mobileOverlay) {
        mobileOverlay.addEventListener('click', closeMenu);
    }

    document.addEventListener('click', function(e) {
        if (mainNav.classList.contains('is-active') && 
            !mainNav.contains(e.target) && 
            !menuToggle.contains(e.target) &&
            (!mobileOverlay || !mobileOverlay.contains(e.target))) {
            closeMenu();
        }
    });

    document.querySelectorAll('.nav-link').forEach(function(link) {
        link.addEventListener('click', function() {
            if (window.innerWidth <= 768) {
                closeMenu();
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', initComponents);
