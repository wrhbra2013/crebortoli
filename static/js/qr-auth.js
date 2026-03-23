function generateToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

function getSessionToken() {
    let token = localStorage.getItem('sig_session_token');
    if (!token) {
        token = generateToken();
        localStorage.setItem('sig_session_token', token);
    }
    return token;
}

async function loadQRCode() {
    const container = document.getElementById('qrcode-container');
    const statusEl = document.getElementById('auth-status');
    const sessionToken = getSessionToken();
    
    const baseUrl = window.location.protocol + '//' + window.location.host;
    const authUrl = `${baseUrl}${getSigPath()}aprovar.html#auth=${sessionToken}`;
    
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(authUrl)}`;
    
    container.innerHTML = `
        <div class="qr-pending">
            <img src="${qrApiUrl}" alt="QR Code" id="qr-image">
            <p id="auth-instructions">Escaneie o QR code com seu celular para aprobar o login</p>
            <div class="session-info">
                <small>Código da sessão: <code>${sessionToken.substring(0, 8)}...</code></small>
            </div>
        </div>
    `;
    
    pollForApproval(sessionToken);
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

function pollForApproval(token) {
    const checkApproval = () => {
        const approved = localStorage.getItem(`sig_approved_${token}`);
        if (approved === 'true') {
            localStorage.setItem('sig_authenticated', 'true');
            localStorage.removeItem(`sig_approved_${token}`);
            window.location.href = getSigPath() + 'index.html';
            return;
        }
        setTimeout(checkApproval, 2000);
    };
    checkApproval();
}

function checkAuth() {
    if (localStorage.getItem('sig_authenticated') === 'true') {
        localStorage.removeItem('sig_authenticated');
        window.location.href = getSigPath() + 'index.html';
    }
}

function pollForApproval(token) {
    const checkApproval = () => {
        const approved = localStorage.getItem(`sig_approved_${token}`);
        if (approved === 'true') {
            localStorage.setItem('sig_authenticated', 'true');
            localStorage.removeItem(`sig_approved_${token}`);
            window.location.href = getBasePath() + 'sig/index.html';
            return;
        }
        setTimeout(checkApproval, 2000);
    };
    checkApproval();
}

function approveLogin() {
    const hash = window.location.hash;
    const match = hash.match(/auth=([A-Za-z0-9]+)/);
    if (match) {
        const token = match[1];
        localStorage.setItem(`sig_approved_${token}`, 'true');
        document.getElementById('approval-result').innerHTML = '<p class="success">Login aprovado! Você pode fechar esta página.</p>';
    } else {
        document.getElementById('approval-result').innerHTML = '<p class="error">Sessão inválida. Gere um novo QR code.</p>';
    }
}

function checkAuth() {
    if (localStorage.getItem('sig_authenticated') === 'true') {
        localStorage.removeItem('sig_authenticated');
        window.location.href = getBasePath() + 'sig/index.html';
    }
}

document.addEventListener("DOMContentLoaded", function() {
    if (document.getElementById('qrcode-container')) {
        loadQRCode();
    }
    if (document.getElementById('auth-status')) {
        checkAuth();
    }
});
