var PathTokens = (function() {
    var STORAGE_KEY = '_cbt_tokens';

    function getMap() {
        try {
            var m = sessionStorage.getItem(STORAGE_KEY);
            return m ? JSON.parse(m) : {};
        } catch(e) { return {}; }
    }

    function saveMap(map) {
        try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch(e) {}
    }

    function generateToken() {
        var arr = new Uint8Array(32);
        crypto.getRandomValues(arr);
        var bin = '';
        for (var i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
        return btoa(bin).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    }

    function encode(plain) {
        if (!plain) return '';
        var map = getMap();
        for (var t in map) {
            if (map.hasOwnProperty(t) && map[t] === plain) return t;
        }
        var token = generateToken();
        map[token] = plain;
        saveMap(map);
        return token;
    }

    function decode(token) {
        if (!token) return null;
        var map = getMap();
        if (map[token]) return map[token];
        return legacyDecode(token);
    }

    var K = [3, 7, 1, 9, 4, 2, 8, 6, 0, 5];

    function legacyDecode(encoded) {
        try {
            var s = encoded.replace(/-/g, '+').replace(/_/g, '/');
            while (s.length % 4) s += '=';
            var decoded = atob(s);
            var r = '';
            for (var i = 0; i < decoded.length; i++)
                r += String.fromCharCode(decoded.charCodeAt(i) ^ K[i % K.length]);
            return r;
        } catch(e) { return null; }
    }

    function clearSession() {
        try { sessionStorage.removeItem(STORAGE_KEY); } catch(e) {}
    }

    return { encode: encode, decode: decode, clearSession: clearSession };
})();

var RouteCrypt = PathTokens;
