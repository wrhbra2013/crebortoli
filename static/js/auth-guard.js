function checkAuth(required = true) {
    const isAuthenticated = localStorage.getItem('sig_authenticated') === 'true';
    
    if (!isAuthenticated && required) {
        localStorage.removeItem('sig_authenticated');
        window.location.href = 'login.html';
        return false;
    }
    
    if (isAuthenticated) {
        localStorage.removeItem('sig_authenticated');
    }
    
    return true;
}

document.addEventListener("DOMContentLoaded", function() {
    const path = window.location.pathname;
    if (path.includes('/sig/') && !path.includes('login.html') && !path.includes('aprovar.html')) {
        checkAuth();
    }
});
