function getBaseUrl() {
    return window.location.protocol + '//' + window.location.host + '/';
}

async function apiSession(acao, dados = {}) {
    const response = await fetch(getBaseUrl() + 'api_session.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao, ...dados })
    });
    return response.json();
}

async function verificarSessao(token) {
    const response = await fetch(getBaseUrl() + 'api_session.php?token=' + token);
    return response.json();
}

function getBasePath() {
    const path = window.location.pathname;
    const pathWithoutFile = path.replace(/\/[^/]*$/, '');
    const depth = pathWithoutFile.split('/').filter(p => p).length;
    return depth > 0 ? '../'.repeat(depth) : './';
}

function getSigPath() {
    return getBasePath() + 'sig/';
}

async function loadQRCode() {
    const container = document.getElementById('qrcode-container');
    if (!container) return;
    
    const baseUrl = window.location.protocol + '//' + window.location.host;
    const authUrl = `${baseUrl}${getSigPath()}aprovar.html`;
    
    const result = await apiSession('criar', { urlAprovacao: authUrl });
    
    if (!result.token) {
        container.innerHTML = '<p class="error">Erro ao gerar QR code. Tente novamente.</p>';
        return;
    }
    
    const approvalUrl = `${authUrl}?token=${result.token}`;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(approvalUrl)}`;
    
    container.innerHTML = `
        <div class="qrcode-container">
            <img src="${qrApiUrl}" alt="QR Code" id="qr-image" style="border: 4px solid #fff; border-radius: 8px;">
            <p id="auth-instructions">Escaneie o QR code com seu celular para aprobar o login</p>
            <div class="session-info">
                <small>Código da sessão: <code>${result.token}</code></small>
            </div>
        </div>
    `;
    
    pollForApproval(result.token);
}

async function pollForApproval(token) {
    const checkApproval = async () => {
        try {
            const result = await apiSession('verificar', { token });
            if (result.status === 'aprovado') {
                localStorage.setItem('sig_authenticated', 'true');
                window.location.href = getSigPath() + 'index.html';
                return;
            }
        } catch (e) {
            console.error('Erro ao verificar sessão:', e);
        }
        setTimeout(checkApproval, 2000);
    };
    checkApproval();
}

async function approveLogin() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
        const result = await apiSession('aprovar', { token });
        if (result.sucesso) {
            document.getElementById('approval-result').innerHTML = '<p class="success">Login aprovado! Você pode fechar esta página.</p>';
        } else {
            document.getElementById('approval-result').innerHTML = '<p class="error">Sessão inválida ou já processada.</p>';
        }
    } else {
        document.getElementById('approval-result').innerHTML = '<p class="error">Sessão inválida. Gere um novo QR code.</p>';
    }
}

function checkAuth() {
    if (localStorage.getItem('sig_authenticated') === 'true') {
        localStorage.removeItem('sig_authenticated');
        window.location.href = getSigPath() + 'index.html';
    }
}

function initQRLogin() {
    const container = document.getElementById('qrcode-container');
    const authStatus = document.getElementById('auth-status');
    
    if (container) {
        loadQRCode();
    }
    if (authStatus) {
        checkAuth();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initQRLogin);
} else {
    initQRLogin();
}
