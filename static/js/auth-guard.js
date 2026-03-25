function getSigBasePath() {
    const path = window.location.pathname;
    if (path.includes('/sig/')) {
        return './';
    }
    return '../';
}

function checkAuth(required = true) {
    const isAuthenticated = localStorage.getItem('sig_authenticated') === 'true';
    
    if (!isAuthenticated && required) {
        window.location.href = 'login.html';
        return false;
    }
    
    return true;
}

function logout() {
    localStorage.removeItem('sig_authenticated');
    localStorage.removeItem('sig_session_token');
    localStorage.removeItem('sig_qr_session');
    window.location.href = 'login.html';
}

document.addEventListener("DOMContentLoaded", function() {
    const path = window.location.pathname;
    if (path.includes('/sig/')) {
        const isPublicPage = path.includes('login.html') || path.includes('aprovar.html');
        if (!isPublicPage) {
            checkAuth();
        }
    }
});
