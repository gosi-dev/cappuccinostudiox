/**
 * Detect base path for subpath hosting (e.g. /cappuccinostudiox).
 * Classic-script compatible (no ES module exports).
 * Sets window.__BASE_PATH and window.__apiUrl for use by all scripts.
 */
(function () {
    if (typeof window.__BASE_PATH === 'string') return;

    var detected = '';

    // 1. <meta name="base-path">
    var meta = document.querySelector('meta[name="base-path"]');
    if (meta && meta.content) {
        detected = meta.content.replace(/\/+$/, '');
    } else {
        // 2. Pathname prefix
        var match = window.location.pathname.match(/^(\/cappuccinostudiox)/);
        if (match) detected = match[1];
    }

    window.__BASE_PATH = detected;

    window.__apiUrl = function (path) {
        return window.__BASE_PATH + path;
    };
})();
