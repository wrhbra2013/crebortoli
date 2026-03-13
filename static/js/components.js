function getBasePath() {
    const path = window.location.pathname;
    if (path.includes('/sig/')) return '../';
    if (path.includes('/paginas/')) return '../';
    return './';
}

function isPublicPage() {
    const path = window.location.pathname;
    return !path.includes('/sig/');
}

const headerSIG = (basePath) => `
<header class="header">
    <div class="container header-container" style="display:flex;align-items:center;justify-content:space-between;width:100%;">
        <a href="${basePath}sig/index.html" class="header-title" aria-label="Página inicial">
            <img src="${basePath}static/css/image/crebortoli.png" alt="Espaço Cre Bortoli" style="height:44px;vertical-align:middle;margin-right:8px;border-radius:6px;"> Espaço Cre Bortoli - SIG
        </a>
        <button id="menu-toggle" class="sandwich-button" aria-label="Abrir menu" aria-expanded="false" aria-controls="main-navigation">
            <span class="sandwich-icon"></span>
        </button>
    </div>
    <nav id="main-navigation" class="main-nav">
        <ul class="menu">
            <li class="nav-item"><a class="nav-link" href="${basePath}sig/index.html">Dashboard</a></li>
            <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle" href="#" role="button" aria-expanded="false">Cadastros</a>
                <ul class="dropdown-menu">
                    <li><a class="dropdown-item" href="${basePath}sig/cadastro_cliente.html">Cliente</a></li>
                    <li><a class="dropdown-item" href="${basePath}sig/cadastro_compra.html">Compra</a></li>
                    <li><a class="dropdown-item" href="${basePath}sig/cadastro_venda_servico.html">Venda Serviço</a></li>
                    <li><a class="dropdown-item" href="${basePath}sig/cadastro_venda_produto.html">Venda Produto</a></li>
                    <li><a class="dropdown-item" href="${basePath}sig/cadastro_colaborador.html">Colaborador</a></li>
                    <li><a class="dropdown-item" href="${basePath}sig/cadastro_anamnese.html">Anamnese</a></li>
                    <li><a class="dropdown-item" href="${basePath}sig/cadastro_relatorio_mei.html">Relatório MEI</a></li>
                    <li><a class="dropdown-item" href="${basePath}sig/cadastro_custos_fixos.html">Custos Fixos</a></li>
                    <li><a class="dropdown-item" href="${basePath}sig/cadastro_insumo.html">Insumo</a></li>
                </ul>
            </li>
            <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle" href="#" role="button" aria-expanded="false">Listagens</a>
                <ul class="dropdown-menu">
                    <li><a class="dropdown-item" href="${basePath}sig/lista_clientes.html">Clientes</a></li>
                    <li><a class="dropdown-item" href="${basePath}sig/lista_compras.html">Compras</a></li>
                    <li><a class="dropdown-item" href="${basePath}sig/lista_vendas_servicos.html">Vendas Serviços</a></li>
                    <li><a class="dropdown-item" href="${basePath}sig/lista_vendas_produtos.html">Vendas Produtos</a></li>
                    <li><a class="dropdown-item" href="${basePath}sig/lista_relatorios_mei.html">Relatórios MEI</a></li>
                    <li><a class="dropdown-item" href="${basePath}sig/lista_colaboradores.html">Colaboradores</a></li>
                    <li><a class="dropdown-item" href="${basePath}sig/lista_anaminese.html">Anamnese</a></li>
                    <li><a class="dropdown-item" href="${basePath}sig/lista_custos_fixos.html">Custos Fixos</a></li>
                    <li><a class="dropdown-item" href="${basePath}sig/lista_insumos.html">Insumos</a></li>
                </ul>
            </li>
            <li class="nav-item"><a class="nav-link" href="${basePath}index.html">Sair</a></li>
        </ul>
    </nav>
</header>
`;

const headerPublic = (basePath) => `
<header class="header" role="banner">
    <div class="container header-container" style="display:flex;align-items:center;justify-content:space-between;width:100%;">
        <a href="${basePath}index.html" class="header-title" aria-label="Página inicial - Espaço Cre Bortoli">
            <img src="${basePath}static/css/image/crebortoli.png" alt="Espaço Cre Bortoli" style="height:44px;vertical-align:middle;margin-right:8px;border-radius:6px;"> Espaço Cre Bortoli
        </a>
        <button id="menu-toggle" class="sandwich-button" aria-label="Abrir menu" aria-expanded="false" aria-controls="main-navigation">
            <span class="sandwich-icon"></span>
        </button>
    </div>
    <nav id="main-navigation" class="main-nav" role="navigation" aria-label="Menu principal">
        <ul class="menu">
            <li class="nav-item"><a class="nav-link" href="${basePath}index.html">Home</a></li>
            <li class="nav-item"><a class="nav-link" href="${basePath}paginas/servicos.html">Serviços</a></li>
            <li class="nav-item"><a class="nav-link" href="${basePath}paginas/agenda.html">Agenda</a></li>
            <li class="nav-item"><a class="nav-link" href="${basePath}paginas/sobre.html">Sobre</a></li>
            <li class="nav-item"><a class="nav-link" href="${basePath}paginas/contato.html">Contato</a></li>
            <li class="nav-item"><a class="nav-link" href="${basePath}sig/login.html">Intranet</a></li>
        </ul>
    </nav>
</header>
`;

const footerHTML = (basePath) => `
<footer class="footer">
    <p>&copy; 2026 Cre Bortoli. Todos os direitos reservados.</p>
</footer>
`;

document.addEventListener("DOMContentLoaded", function() {
    const basePath = getBasePath();
    const header = isPublicPage() ? headerPublic(basePath) : headerSIG(basePath);
    document.getElementById('header-placeholder').innerHTML = header;
    document.getElementById('footer-placeholder').innerHTML = footerHTML(basePath);
    
    if (typeof initMenu === 'function') {
        initMenu();
    } else {
        const mainScript = document.createElement('script');
        mainScript.src = basePath + 'static/js/main.js';
        mainScript.onload = function() {
            initMenu();
        };
        document.body.appendChild(mainScript);
    }
});
