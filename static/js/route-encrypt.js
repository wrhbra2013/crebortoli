var RouteCrypt = (function() {
    var K = [3, 7, 1, 9, 4, 2, 8, 6, 0, 5];

    function _xor(s) {
        var r = '';
        for (var i = 0; i < s.length; i++)
            r += String.fromCharCode(s.charCodeAt(i) ^ K[i % K.length]);
        return r;
    }

    function encode(plain) {
        return btoa(_xor(plain)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    }

    function decode(encoded) {
        try {
            var s = encoded.replace(/-/g, '+').replace(/_/g, '/');
            while (s.length % 4) s += '=';
            return _xor(atob(s));
        } catch(e) { return null; }
    }

    return { encode: encode, decode: decode };
})();
