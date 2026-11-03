/* Extracted from index.html so the page can run under a strict CSP (script-src 'self'). */
        // Keep logo navigation portable across root and subpath hosting.
        document.addEventListener('DOMContentLoaded', function() {
            const logoLink = document.getElementById('logoLink');
            if (logoLink) {
                logoLink.addEventListener('click', function(e) {
                    e.preventDefault();
                    window.location.href = 'index.html';
                });
            }
        });
    