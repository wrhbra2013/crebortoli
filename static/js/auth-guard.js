function getBasePath() {
    const path = window.location.pathname;
    let depth = (path.match(/\//g) || []).length;
    if (path.endsWith('/')) depth--;
    depth = Math.max(0, depth - 1);
    return '../'.repeat(depth);
}

function checkAuth(required = true) {
    const isAuthenticated = localStorage.getItem('sig_authenticated') === 'true';
    
    if (!isAuthenticated && required) {
        localStorage.removeItem('sig_authenticated');
        window.location.href = getBasePath() + 'sig/login.html';
        return false;
    }
    
    return true;
}

function logout() {
    localStorage.removeItem('sig_authenticated');
    localStorage.removeItem('sig_session_token');
    window.location.href = getBasePath() + 'sig/login.html';
}

document.addEventListener("DOMContentLoaded", function() {
    const path = window.location.pathname;
    if (path.includes('/sig/') && !path.includes('login.html') && !path.includes('aprovar.html')) {
        checkAuth();
    }
});
