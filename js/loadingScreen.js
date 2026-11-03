/**
 * Shared loading screen: red full page, Cappuccino Studio logo (half of previous 2× size),
 * wipe bottom-to-top: 0→10→20% during load; on ready 50% then 50→80% over 1.5s, 80→100% over 0.5s (T+2s); then fade out/in.
 * First-visit per session for some pages.
 */
const LOGO_HEIGHT_OTHER = 83.52;
const LOGO_HEIGHT_LOADING = Math.round(LOGO_HEIGHT_OTHER); /* half of previous 2× size */
const LOGO_SOURCE_WIDTH = 600;
const LOGO_SOURCE_HEIGHT = 740;
const LOGO_WIDTH_LOADING = Math.round((LOGO_HEIGHT_LOADING * LOGO_SOURCE_WIDTH) / LOGO_SOURCE_HEIGHT);
const RED_BG = '#E70017';
const SESSION_VISITED_KEY = 'loadingScreen_visited';
const LOADING_ACTIVE_CLASS = 'loading-active';
const WIPE_PHASE2_MS = 1500;  // 50% → 80%
const WIPE_PHASE3_MS = 500;   // 80% → 100% (total added time = 2s)
const FADE_DURATION_MS = 400;

let overlay = null;
let wipeEl = null;
let currentProgress = 0;
let loadPhaseTimeouts = [];

const styles = `
.loading-screen-overlay {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    min-width: 100vw;
    min-height: 100vh;
    min-height: 100dvh;
    overflow: hidden;
    background: ${RED_BG};
    z-index: 99999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: 'Code Saver', sans-serif;
    transition: opacity ${FADE_DURATION_MS}ms ease-out;
}
.loading-screen-logo-zone {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
body.loading-active > *:not(#loadingScreenOverlay) {
    opacity: 0;
    transition: opacity ${FADE_DURATION_MS}ms ease-out;
}
body:not(.loading-active) > *:not(#loadingScreenOverlay) {
    opacity: 1;
}
.loading-screen-logo-wrap {
    position: relative;
    width: ${LOGO_WIDTH_LOADING}px;
    height: ${LOGO_HEIGHT_LOADING}px;
    flex-shrink: 0;
}
.loading-screen-logo-wrap img {
    display: block;
    height: ${LOGO_HEIGHT_LOADING}px;
    width: auto;
    vertical-align: middle;
}
.loading-screen-wipe {
    position: absolute;
    left: 0; right: 0; top: 0;
    height: calc((100 - var(--loading-progress, 0)) * 1%);
    background: ${RED_BG};
    transition: height 0.35s linear;
    pointer-events: none;
}
`;

let styleInjected = false;
function ensureStyles() {
    if (styleInjected) return;
    const style = document.createElement('style');
    style.id = 'loading-screen-styles';
    style.textContent = styles;
    document.head.appendChild(style);
    styleInjected = true;
}

function ensureOverlay() {
    ensureStyles();
    if (overlay) return overlay;
    const existing = document.getElementById('loadingScreenOverlay');
    if (existing) {
        overlay = existing;
        wipeEl = overlay.querySelector('.loading-screen-wipe');
        let logoZone = overlay.querySelector('.loading-screen-logo-zone');
        const logoWrapEl = overlay.querySelector('.loading-screen-logo-wrap');
        const logoImgEl = logoWrapEl ? logoWrapEl.querySelector('img') : null;
        if (logoWrapEl && !logoZone) {
            logoZone = document.createElement('div');
            logoZone.className = 'loading-screen-logo-zone';
            logoWrapEl.parentNode.insertBefore(logoZone, logoWrapEl);
            logoZone.appendChild(logoWrapEl);
        }
        if (logoWrapEl) {
            logoWrapEl.style.width = LOGO_WIDTH_LOADING + 'px';
            logoWrapEl.style.height = LOGO_HEIGHT_LOADING + 'px';
        }
        if (logoImgEl) {
            logoImgEl.setAttribute('width', String(LOGO_WIDTH_LOADING));
            logoImgEl.setAttribute('height', String(LOGO_HEIGHT_LOADING));
            logoImgEl.style.width = 'auto';
            logoImgEl.style.height = LOGO_HEIGHT_LOADING + 'px';
            logoImgEl.style.display = 'block';
        }
        if (wipeEl) wipeEl.style.setProperty('--loading-progress', '0');
        return overlay;
    }
    overlay = document.createElement('div');
    overlay.id = 'loadingScreenOverlay';
    overlay.className = 'loading-screen-overlay';
    overlay.setAttribute('aria-live', 'polite');
    overlay.setAttribute('aria-label', 'Loading');
    const logoZone = document.createElement('div');
    logoZone.className = 'loading-screen-logo-zone';
    const logoWrap = document.createElement('div');
    logoWrap.className = 'loading-screen-logo-wrap';
    logoWrap.style.width = LOGO_WIDTH_LOADING + 'px';
    logoWrap.style.height = LOGO_HEIGHT_LOADING + 'px';
    const img = document.createElement('img');
    img.src = 'Studioxx Logo.png';
    img.alt = 'Cappuccino Studio';
    img.setAttribute('width', String(LOGO_WIDTH_LOADING));
    img.setAttribute('height', String(LOGO_HEIGHT_LOADING));
    img.style.width = 'auto';
    img.style.height = LOGO_HEIGHT_LOADING + 'px';
    logoWrap.appendChild(img);
    wipeEl = document.createElement('div');
    wipeEl.className = 'loading-screen-wipe';
    wipeEl.style.setProperty('--loading-progress', '0');
    logoWrap.appendChild(wipeEl);
    logoZone.appendChild(logoWrap);
    overlay.appendChild(logoZone);
    document.body.appendChild(overlay);
    styleInjected = true;
    return overlay;
}

export function showLoadingScreen(pageOrProjectName) {
    ensureOverlay();
    loadPhaseTimeouts.forEach(t => clearTimeout(t));
    loadPhaseTimeouts = [];
    currentProgress = 0;
    if (wipeEl) {
        wipeEl.style.transition = 'height 0.35s linear';
        wipeEl.style.setProperty('--loading-progress', '0');
    }
    overlay.style.display = 'flex';
    overlay.style.opacity = '1';
    document.body.classList.add(LOADING_ACTIVE_CLASS);
    loadPhaseTimeouts.push(setTimeout(() => setLoadingProgress(10), 150));
    loadPhaseTimeouts.push(setTimeout(() => setLoadingProgress(20), 350));
}

/**
 * Dismiss the loading screen without animation (e.g. on revisit when we skip showing it).
 * Removes loading-active from body and hides the overlay; reveals page (fade-in) via page transition.
 */
export function dismissLoadingScreen() {
    document.body.classList.remove(LOADING_ACTIVE_CLASS);
    const el = overlay || document.getElementById('loadingScreenOverlay');
    if (el) el.style.display = 'none';
    import('./pageTransition.js').then(m => { if (m.revealPage) m.revealPage(); });
}

/**
 * Set load progress 0–100. Drives the bottom-to-top wipe (0% = 0% visible, 100% = fully visible).
 * @param {number} percent - 0 to 100.
 */
export function setLoadingProgress(percent) {
    if (!wipeEl) return;
    const p = Math.min(100, Math.max(0, Number(percent)));
    currentProgress = p;
    wipeEl.style.setProperty('--loading-progress', String(p));
}

/**
 * Whether this page has already been visited in the current session (used to skip loading screen on cached/revisit).
 * @param {string} pageKey - e.g. 'index.html', 'kitchen.html', 'admin.html'
 * @returns {boolean}
 */
export function hasVisitedPage(pageKey) {
    try {
        const raw = sessionStorage.getItem(SESSION_VISITED_KEY);
        const set = raw ? JSON.parse(raw) : null;
        return Array.isArray(set) && set.includes(pageKey);
    } catch (_) {
        return false;
    }
}

/**
 * Mark the page as visited this session so the loading screen is skipped on next navigation to it.
 * @param {string} pageKey - e.g. 'index.html', 'kitchen.html', 'admin.html'
 */
export function markPageVisited(pageKey) {
    try {
        const raw = sessionStorage.getItem(SESSION_VISITED_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        const set = Array.isArray(parsed) ? parsed : [];
        if (!set.includes(pageKey)) {
            set.push(pageKey);
            sessionStorage.setItem(SESSION_VISITED_KEY, JSON.stringify(set));
        }
    } catch (_) {}
}

/**
 * Show the loading screen only on first visit this session (no cached load). Use for landing, kitchen, admin.
 * @param {string} pageKey - e.g. 'index.html', 'kitchen.html', 'admin.html'
 * @param {string} label - Display name for "Loading Label" (e.g. "Landing", "Kitchen", "Admin")
 * @returns {boolean} - true if the loading screen was shown, false if skipped (already visited)
 */
export function showLoadingScreenIfFirstVisit(pageKey, label) {
    if (hasVisitedPage(pageKey)) {
        dismissLoadingScreen();
        return false;
    }
    showLoadingScreen(label || pageKey);
    return true;
}

/**
 * Hide the loading screen: jump to 50%, wipe 50→80% over 3.5s, then 80→100% over 0.5s, then fade out overlay and fade in page.
 * @param {object} [opts] - Optional: { label?: string }
 */
export function hideLoadingScreen(opts = {}) {
    loadPhaseTimeouts.forEach(t => clearTimeout(t));
    loadPhaseTimeouts = [];
    const el = overlay || document.getElementById('loadingScreenOverlay');
    if (!el) return;
    if (!wipeEl) {
        // wipeEl missing — force dismiss immediately so page is never stuck
        document.body.classList.remove(LOADING_ACTIVE_CLASS);
        el.style.display = 'none';
        import('./pageTransition.js').then(m => { if (m.revealPage) m.revealPage(); });
        return;
    }

    let dismissed = false;
    function forceDismiss() {
        if (dismissed) return;
        dismissed = true;
        document.body.classList.remove(LOADING_ACTIVE_CLASS);
        el.style.display = 'none';
        el.style.opacity = '1';
        import('./pageTransition.js').then(m => { if (m.revealPage) m.revealPage(); });
    }

    // Safety timeout: if transitionend events never fire, force dismiss
    const safetyMs = WIPE_PHASE2_MS + WIPE_PHASE3_MS + FADE_DURATION_MS + 800;
    const safetyTimer = setTimeout(forceDismiss, safetyMs);

    const doFadeAndHide = () => {
        el.style.opacity = '0';
        el.addEventListener('transitionend', function onFadeOut() {
            el.removeEventListener('transitionend', onFadeOut);
            clearTimeout(safetyTimer);
            if (dismissed) return;
            dismissed = true;
            document.body.classList.remove(LOADING_ACTIVE_CLASS);
            el.style.display = 'none';
            el.style.opacity = '1';
            import('./pageTransition.js').then(m => { if (m.revealPage) m.revealPage(); });
        }, { once: true });
    };

    wipeEl.style.transition = 'none';
    wipeEl.style.setProperty('--loading-progress', '50');
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            wipeEl.style.transition = 'height ' + (WIPE_PHASE2_MS / 1000) + 's linear';
            wipeEl.style.setProperty('--loading-progress', '80');
            wipeEl.addEventListener('transitionend', function phase2Done() {
                wipeEl.removeEventListener('transitionend', phase2Done);
                wipeEl.style.transition = 'height ' + (WIPE_PHASE3_MS / 1000) + 's linear';
                wipeEl.style.setProperty('--loading-progress', '100');
                wipeEl.addEventListener('transitionend', doFadeAndHide, { once: true });
            }, { once: true });
        });
    });
}
