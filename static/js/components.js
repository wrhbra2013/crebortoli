function getBasePath() {
    const path = window.location.pathname;
    const pathWithoutFile = path.replace(/\/[^/]*$/, '');
    const depth = pathWithoutFile.split('/').filter(p => p).length;
    return depth > 0 ? '../'.repeat(depth) : './';
}

function getStaticPath() {
    return getBasePath() + 'static/';
}

function initComponents() {
    const staticPath = getStaticPath();
    
    const headerHTML = `<header class="header">
    <div class="header-container">
        <a href="${getBasePath()}index.html" class="header-title">
            <span class="site-title">Espaço Cre Bortoli</span>
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
            <li class="nav-item"><a class="nav-link" href="${getBasePath()}paginas/sobre.html">Sobre</a></li>
            <li class="nav-item"><a class="nav-link" href="${getBasePath()}paginas/contato.html">Contato</a></li>
            <li class="nav-item"><a class="nav-link" href="${getBasePath()}sig/login.html">Intranet</a></li>
        </ul>
    </nav>
</header>
<div class="mobile-overlay" id="mobile-overlay"></div>`;

    const headerSigHTML = `<header class="header">
    <div class="header-container">
        <a href="${getBasePath()}sig/index.html" class="header-title">
            <span class="site-title">Espaço Cre Bortoli - SIG</span>
        </a>
        <button id="menu-toggle" class="sandwich-button" aria-label="Abrir menu" aria-expanded="false">
            <span></span>
            <span></span>
            <span></span>
        </button>
    </div>
    <nav id="main-navigation" class="main-nav">
        <ul class="menu">
            <li class="nav-item"><a class="nav-link" href="${getBasePath()}sig/index.html">Dashboard</a></li>
            <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle" href="#">Cadastros</a>
                <ul class="dropdown-menu">
                    <li><a class="dropdown-item" href="${getBasePath()}sig/cadastro_cliente.html">Cliente</a></li>
                    <li><a class="dropdown-item" href="${getBasePath()}sig/cadastro_compra.html">Compra</a></li>
                    <li><a class="dropdown-item" href="${getBasePath()}sig/cadastro_venda_servico.html">Venda Serviço</a></li>
                    <li><a class="dropdown-item" href="${getBasePath()}sig/cadastro_venda_produto.html">Venda Produto</a></li>
                    <li><a class="dropdown-item" href="${getBasePath()}sig/cadastro_colaborador.html">Colaborador</a></li>
                    <li><a class="dropdown-item" href="${getBasePath()}sig/cadastro_anamnese.html">Anamnese</a></li>
                    <li><a class="dropdown-item" href="${getBasePath()}sig/cadastro_relatorio_mei.html">Relatório MEI</a></li>
                    <li><a class="dropdown-item" href="${getBasePath()}sig/cadastro_custos_fixos.html">Custos Fixos</a></li>
                    <li><a class="dropdown-item" href="${getBasePath()}sig/cadastro_insumo.html">Insumo</a></li>
                </ul>
            </li>
            <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle" href="#">Listagens</a>
                <ul class="dropdown-menu">
                    <li><a class="dropdown-item" href="${getBasePath()}sig/lista_agendamentos.html">Agendamentos</a></li>
                    <li><a class="dropdown-item" href="${getBasePath()}sig/lista_mensagens.html">Mensagens</a></li>
                    <li><a class="dropdown-item" href="${getBasePath()}sig/lista_clientes.html">Clientes</a></li>
                    <li><a class="dropdown-item" href="${getBasePath()}sig/lista_compras.html">Compras</a></li>
                    <li><a class="dropdown-item" href="${getBasePath()}sig/lista_vendas_servicos.html">Vendas Serviços</a></li>
                    <li><a class="dropdown-item" href="${getBasePath()}sig/lista_vendas_produtos.html">Vendas Produtos</a></li>
                    <li><a class="dropdown-item" href="${getBasePath()}sig/lista_relatorios_mei.html">Relatórios MEI</a></li>
                    <li><a class="dropdown-item" href="${getBasePath()}sig/lista_colaboradores.html">Colaboradores</a></li>
                    <li><a class="dropdown-item" href="${getBasePath()}sig/lista_anaminese.html">Anamnese</a></li>
                    <li><a class="dropdown-item" href="${getBasePath()}sig/lista_custos_fixos.html">Custos Fixos</a></li>
                    <li><a class="dropdown-item" href="${getBasePath()}sig/lista_insumos.html">Insumos</a></li>
                </ul>
            </li>
            <li class="nav-item"><a class="nav-link" href="${getBasePath()}index.html">Sair</a></li>
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
