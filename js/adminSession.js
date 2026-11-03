/**
 * Admin session helper.
 *
 * The admin token is never stored in this repo. It is read from the operator at
 * runtime, kept in sessionStorage for the tab, and attached to same-origin /api
 * requests as `X-Admin-Token`. The Netlify Function verifies it server-side
 * (netlify/lib/adminAuth.js), so a leaked page cannot authorise itself.
 *
 * SECRET — SET IN NETLIFY ENV: ADMIN_TOKEN
 */
(function () {
    var TOKEN_KEY = 'admin_token';
    var nativeFetch = window.fetch.bind(window);

    function basePath() {
        return (typeof window.__BASE_PATH === 'string' ? window.__BASE_PATH : '');
    }

    function isAdminApi(input) {
        try {
            var raw = typeof input === 'string' ? input : (input && input.url) || '';
            var url = new URL(raw, window.location.href);
            if (url.origin !== window.location.origin) return false;
            return url.pathname.indexOf(basePath() + '/api/') === 0;
        } catch (e) {
            return false;
        }
    }

    window.fetch = function (input, init) {
        if (!isAdminApi(input)) return nativeFetch(input, init);
        var token = '';
        try { token = window.sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) {}
        if (!token) return nativeFetch(input, init);
        var options = init ? Object.assign({}, init) : {};
        var headers = new Headers(options.headers || (input instanceof Request ? input.headers : undefined));
        if (!headers.has('X-Admin-Token')) headers.set('X-Admin-Token', token);
        options.headers = headers;
        return nativeFetch(input, options);
    };

    function askForToken(reason) {
        var entered = window.prompt(reason || 'Admin token (leave blank for read-only):', '');
        if (entered == null) return null;
        var token = String(entered).trim();
        try {
            if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
            else window.sessionStorage.removeItem(TOKEN_KEY);
        } catch (e) {}
        return token;
    }

    function verifyToken() {
        var token = '';
        try { token = window.sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) {}
        if (!token) return Promise.resolve(false);
        // Dedicated probe endpoint: 200 means the token is accepted, and it
        // returns no booking data.
        return nativeFetch(basePath() + '/api/admin/session', { headers: { 'X-Admin-Token': token } })
            .then(function (res) { return res.ok; })
            .catch(function () { return false; });
    }

    window.AdminSession = { askForToken: askForToken, verifyToken: verifyToken };

    document.addEventListener('DOMContentLoaded', function () {
        verifyToken().then(function (ok) {
            if (ok) return;
            askForToken('This page writes to the live site. Paste the ADMIN_TOKEN (leave blank for read-only):');
        });
    });
})();
