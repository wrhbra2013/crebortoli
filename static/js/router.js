var AppRouter = (function() {
    var mainEl = null;
    var currentPath = '';
    var _inited = false;
    window.__routerPath = '';

    function init() {
        if (_inited) return;
        _inited = true;
        mainEl = document.querySelector('main');
        if (!mainEl) return;

        window.addEventListener('hashchange', onHashChange);

        var hash = window.location.hash.replace(/^#\//, '');
        if (hash) {
            var path = RouteCrypt.decode(hash);
            if (path) {
                setPath(path);
                loadPage(path);
                return;
            }
        }
        setPath('index.html');
        if (typeof initComponents === 'function') {
            initComponents();
        }
        updateNavLinks();
    }

    function setPath(path) {
        currentPath = path;
        window.__routerPath = path;
    }

    function onHashChange() {
        var hash = window.location.hash.replace(/^#\//, '');
        if (!hash) {
            setPath('index.html');
            loadPage('index.html');
            return;
        }
        var path = RouteCrypt.decode(hash);
        if (path && path !== currentPath) {
            setPath(path);
            loadPage(path);
        } else if (!path) {
            loadPage('index.html');
        }
    }

    function navigate(path) {
        if (path === currentPath) return;
        var encoded = RouteCrypt.encode(path);
        window.location.hash = '#/' + encoded;
    }

    function loadPage(path) {
        fetch(path)
            .then(function(r) {
                if (!r.ok) throw new Error('Page not found: ' + path);
                return r.text();
            })
            .then(function(html) {
                renderPage(html);
            })
            .catch(function(err) {
                console.error('Router:', err);
                if (path !== 'index.html') {
                    navigate('index.html');
                }
            });
    }

    function renderPage(html) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');

        var title = doc.querySelector('title');
        if (title) document.title = title.textContent;

        var newMain = doc.querySelector('main');
        if (!newMain) return;

        mainEl.innerHTML = newMain.innerHTML;

        patchDocumentWrite();

        var pageScripts = doc.querySelectorAll('script');
        pageScripts.forEach(function(oldScript) {
            if (oldScript.getAttribute('src')) return;
            if (oldScript.textContent.indexOf('document.write') !== -1) return;
            var ns = document.createElement('script');
            ns.textContent = oldScript.textContent;
            document.body.appendChild(ns);
            document.body.removeChild(ns);
        });

        restoreDocumentWrite();
        document.dispatchEvent(new Event('DOMContentLoaded'));

        if (typeof initComponents === 'function') {
            initComponents();
        }
        updateNavLinks();
    }

    var _origWrite;

    function patchDocumentWrite() {
        _origWrite = document.write;
        document.write = function() {};
    }

    function restoreDocumentWrite() {
        document.write = _origWrite || document.write;
    }

    function updateNavLinks() {
        document.querySelectorAll('.nav-link').forEach(function(a) {
            var href = a.getAttribute('href');
            if (href && !href.startsWith('#') && !href.startsWith('http') && !href.startsWith('javascript')) {
                var encoded = RouteCrypt.encode(href);
                a.setAttribute('href', '#/' + encoded);
            }
        });
    }

    return {
        init: init,
        navigate: navigate
    };
})();
