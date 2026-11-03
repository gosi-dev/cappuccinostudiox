/* Extracted from project.html so the page can run under a strict CSP (script-src 'self'). */
    // Safety net: if JS errors or CSS transitions stall, force-dismiss loading screen
    (function () {
        var MAX_WAIT = 4000;
        var done = false;
        function dismiss() {
            if (done) return;
            done = true;
            document.body.classList.remove('loading-active');
            document.body.classList.remove('page-entering');
            document.body.classList.remove('page-exiting');
            var ov = document.getElementById('loadingScreenOverlay');
            if (ov) ov.style.display = 'none';
            var children = document.body.children;
            for (var i = 0; i < children.length; i++) {
                if (children[i].id !== 'loadingScreenOverlay') {
                    children[i].style.opacity = '1';
                }
            }
        }
        setTimeout(dismiss, MAX_WAIT);
        window.addEventListener('load', function () {
            setTimeout(dismiss, 2000);
        });
    })();
    