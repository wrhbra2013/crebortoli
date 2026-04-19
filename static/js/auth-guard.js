const AUTH_KEY = 'sig_authenticated';
const AUTH_TIMESTAMP = 'sig_auth_time';
const AUTH_TOKEN = 'sig_token';
const AUTH_TIMEOUT = 30 * 60 * 1000;

function generateSecureToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

function hashToken(token) {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
        const char = token.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(16);
}

function checkAuth(required = true) {
    const isAuthenticated = localStorage.getItem(AUTH_KEY) === 'true';
    const authTime = parseInt(localStorage.getItem(AUTH_TIMESTAMP) || '0', 10);
    const storedHash = localStorage.getItem(AUTH_TOKEN);
    
    if (isAuthenticated && authTime) {
        const elapsed = Date.now() - authTime;
        if (elapsed > AUTH_TIMEOUT) {
            logout();
            if (required) {
                window.location.href = 'login.html';
            }
            return false;
        }
        
        if (!storedHash) {
            logout();
            if (required) {
                window.location.href = 'login.html';
            }
            return false;
        }
        
        return true;
    }
    
    if (required) {
        window.location.href = 'login.html';
        return false;
    }
    
    return false;
}

function login(token) {
    const secureToken = generateSecureToken();
    const tokenHash = hashToken(secureToken);
    
    localStorage.setItem(AUTH_KEY, 'true');
    localStorage.setItem(AUTH_TIMESTAMP, Date.now().toString());
    localStorage.setItem(AUTH_TOKEN, tokenHash);
    
    localStorage.setItem('sig_last_login', Date.now().toString());
}

function logout() {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(AUTH_TIMESTAMP);
    localStorage.removeItem(AUTH_TOKEN);
    window.location.href = 'login.html';
}

function isAuthenticated() {
    return localStorage.getItem(AUTH_KEY) === 'true';
}

function refreshSession() {
    if (isAuthenticated()) {
        localStorage.setItem(AUTH_TIMESTAMP, Date.now().toString());
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const path = window.location.pathname;
    if (path.includes('/sig/')) {
        const isPublicPage = path.includes('login.html') || path.includes('aprovar.html');
        if (!isPublicPage) {
            checkAuth();
        }
    }
    
    if (isAuthenticated()) {
        setInterval(refreshSession, 5 * 60 * 1000);
    }
});
