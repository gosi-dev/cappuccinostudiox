/* Extracted from project-edit.html so the page can run under a strict CSP (script-src 'self'). */
        // Ensure logo is clickable and navigates
        document.addEventListener('DOMContentLoaded', function() {
            const logoLink = document.querySelector('.navigation a[href="index.html"]');
            if (logoLink) {
                logoLink.addEventListener('click', function(e) {
                    window.location.href = 'index.html';
                });
            }
        });
    