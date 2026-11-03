/**
 * Header nav: on phones the five page links are wider than the header, so the
 * row scrolls sideways (offers + book a session). Centre the current page inside
 * that row so the visitor can always see where they are.
 */
(function () {
    const NAV_SELECTOR = '.of-nav, .booking-nav';

    function revealCurrentLink() {
        document.querySelectorAll(NAV_SELECTOR).forEach((nav) => {
            const current = nav.querySelector('[aria-current="page"]');
            if (!current) return;
            const overflow = nav.scrollWidth - nav.clientWidth;
            if (overflow <= 1) {
                nav.scrollLeft = 0;
                return;
            }
            // Measure against the scroll row itself: offsetLeft is relative to
            // the sticky header (the offsetParent), which also contains the
            // brand mark and the header padding.
            const navLeft = nav.getBoundingClientRect().left;
            const linkRect = current.getBoundingClientRect();
            const linkStart = linkRect.left - navLeft + nav.scrollLeft;
            const centred = linkStart - (nav.clientWidth - linkRect.width) / 2;
            nav.scrollLeft = Math.max(0, Math.min(overflow, centred));
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', revealCurrentLink);
    } else {
        revealCurrentLink();
    }

    window.addEventListener('resize', revealCurrentLink);
    window.addEventListener('load', revealCurrentLink);
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(revealCurrentLink);
    }
})();
