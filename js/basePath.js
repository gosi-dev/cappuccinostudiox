/**
 * Detect base path for when the portfolio is hosted under a subpath (e.g. /cappuccinostudiox).
 * ES module version — import { apiUrl, BASE_PATH } from './basePath.js'
 *
 * The classic <script src="js/basePath-init.js"></script> handles the window
 * globals; this module re-runs detection only if that script hasn't loaded yet.
 */

(function () {
    if (typeof window.__BASE_PATH === 'string') return;

    var detected = '';
    var meta = document.querySelector('meta[name="base-path"]');
    if (meta && meta.content) {
        detected = meta.content.replace(/\/+$/, '');
    } else {
        var match = window.location.pathname.match(/^(\/cappuccinostudiox)/);
        if (match) detected = match[1];
    }

    window.__BASE_PATH = detected;
    window.__apiUrl = function (path) {
        return window.__BASE_PATH + path;
    };
})();

export var BASE_PATH = window.__BASE_PATH;
export function apiUrl(path) { return window.__apiUrl(path); }
