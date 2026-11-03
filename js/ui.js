/**
 * Menus and carousel UI.
 */
import { getPageName, escapeHtml } from './core.js';
import { navigateTo } from './pageTransition.js';
import { getRandomChar, scrambleText } from './animations.js';

const CAROUSEL_REPETITIONS = 10;
const CAROUSEL_PHASE1 = 15;
const CAROUSEL_PHASE2 = 25;
const CAROUSEL_FRAME_DELAY = 16;
const CAROUSEL_INTERVAL_MS = 8000;

/** Shared carousel text sets (same across index, kitchen, project-files, admin, 3d-cabinet). */
export const carouselSets = {
    1: 'CAPPUCCINO STUDIOS, FLOATING ISLANDS, LUCID JUNGLES',
    2: 'TAP ANY PULSING PROBE TO INTERACT',
    3: 'LOADING KITCHEN SCENE',
    4: 'CAPPUCCINO STUDIOS, DREAMS DO COME TRUE',
    5: 'CLICK ITEM TO VIEW DETAILS',
    6: 'DRAG OR SCROLL TO EXPLORE SCENE'
};

/** Page name -> array of set numbers for carousel cycle. */
export const pageCarouselSets = {
    'index.html': [2, 1, 6],
    'kitchen.html': [2, 6, 4],
    'project-files.html': [1, 4, 5, 6],
    'admin.html': [1, 4, 5, 6],
    '3d-cabinet.html': [1, 4, 5, 6]
};

/**
 * Simple dropdown menu: toggle active on button, close on outside click.
 * Use for project page menu (projectMenuContainer, projectMenuButton).
 */
export function setupMenuSimple(containerId, buttonId) {
    const container = document.getElementById(containerId);
    const button = document.getElementById(buttonId);
    if (!container || !button) return;
    const pageName = getPageName();
    container.querySelectorAll('.menu-child-button').forEach(btn => {
        const target = (btn.getAttribute && btn.getAttribute('href')) || btn.dataset.page;
        if (target === pageName) btn.remove();
    });
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        container.classList.toggle('active');
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.menu-container')) container.classList.remove('active');
    });
}

/**
 * Dropdown menu with open/close animation (staggered child buttons).
 * Use for index, kitchen, project-files, admin, 3d-cabinet.
 */
export function setupMenuAnimated(containerId, buttonId, options = {}) {
    const container = document.getElementById(containerId);
    const button = document.getElementById(buttonId);
    if (!container || !button) return;
    const pageName = getPageName();
    let childButtons = container.querySelectorAll('.menu-child-button');
    Array.from(childButtons).forEach(btn => {
        if (btn.dataset.page === pageName) btn.remove();
    });
    childButtons = container.querySelectorAll('.menu-child-button');

    function closeMenu() {
        childButtons.forEach((btn, index) => {
            btn.style.display = 'flex';
            btn.style.opacity = '1';
            const reverseIndex = childButtons.length - 1 - index;
            const delay = `${reverseIndex * 0.1}s`;
            btn.style.animationDelay = delay;
            btn.style.setProperty('--flash-delay', delay);
        });
        requestAnimationFrame(() => container.classList.remove('active'));
        const maxDelay = (childButtons.length - 1) * 0.1;
        setTimeout(() => {
            childButtons.forEach(btn => {
                btn.style.display = 'none';
                btn.style.animationDelay = '';
                btn.style.opacity = '';
                btn.style.removeProperty('--flash-delay');
            });
        }, 200 + (maxDelay * 1000));
    }

    button.addEventListener('click', (e) => {
        e.stopPropagation();
        if (container.classList.contains('active')) {
            closeMenu();
        } else {
            childButtons.forEach((btn, index) => {
                btn.style.display = 'flex';
                const delay = `${index * 0.1}s`;
                btn.style.animationDelay = delay;
                btn.style.setProperty('--flash-delay', delay);
            });
            container.classList.add('active');
        }
    });

    if (childButtons.length > 0) {
        const originalDisplay = [];
        childButtons.forEach((btn, i) => { originalDisplay[i] = btn.style.display; btn.style.display = 'flex'; btn.style.visibility = 'hidden'; btn.style.position = 'absolute'; });
        let maxWidth = 0;
        childButtons.forEach(btn => { btn.style.width = 'auto'; const w = btn.offsetWidth; if (w > maxWidth) maxWidth = w; });
        childButtons.forEach((btn, i) => { btn.style.display = originalDisplay[i] || 'none'; btn.style.visibility = ''; btn.style.position = ''; btn.style.width = maxWidth + 'px'; });
    }

    childButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const page = btn.dataset.page;
            const modal = btn.dataset.modal;
            const action = btn.dataset.action;
            if (modal && typeof window.openModal === 'function') {
                window.openModal(modal);
                closeMenu();
            } else if (page) navigateTo(page);
            else if (action === 'book-session') container.classList.remove('active');
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.menu-container') && container.classList.contains('active')) closeMenu();
    });
}

/**
 * Init text carousel with scramble animation.
 * options: { carouselSets, pageCarouselSets?, defaultPage?, intervalMs?, firstSetText? }
 * firstSetText: when loading screen is active, use this as the first set (e.g. 'LOADING (PROJECT FILES)') then cycle normal sets.
 */
export function initCarousel(trackId, options) {
    const track = document.getElementById(trackId);
    if (!track) return;
    const { carouselSets, pageCarouselSets = {}, defaultPage = 'index.html', intervalMs = CAROUSEL_INTERVAL_MS, firstSetText = null } = options;
    const pageName = getPageName();
    const normalSets = pageCarouselSets[pageName] || pageCarouselSets[defaultPage] || pageCarouselSets['index.html'] || [2, 1, 6];
    const sets = firstSetText ? [firstSetText, ...normalSets] : normalSets;
    let currentSetText = '';
    let scrambleSeed = 0;

    function createContent(setNumberOrText, textOverride = null) {
        const text = textOverride || (typeof setNumberOrText === 'string' ? setNumberOrText : carouselSets[setNumberOrText]);
        // Carousel copy is static today, but escaping keeps a future dynamic set
        // from turning this innerHTML into a sink.
        const safeText = escapeHtml(text);
        let html = '<span class="carousel-separator"></span>';
        for (let i = 0; i < CAROUSEL_REPETITIONS; i++) {
            html += `<span class="carousel-item">${safeText}</span>`;
            html += '<span class="carousel-separator"></span>';
        }
        return html;
    }

    function updateCarousel(setNumberOrText) {
        const targetText = typeof setNumberOrText === 'string' ? setNumberOrText : carouselSets[setNumberOrText];
        scrambleSeed = Math.floor(Math.random() * 1000000);
        let phase = 0, frame = 0;
        let lastTime = performance.now();

        function animate(currentTime) {
            if (currentTime - lastTime < CAROUSEL_FRAME_DELAY) {
                requestAnimationFrame(animate);
                return;
            }
            lastTime = currentTime;
            let progress, displayText;
            if (phase === 0) {
                progress = frame / CAROUSEL_PHASE1;
                displayText = scrambleText(currentSetText, targetText, 0, progress, frame, scrambleSeed);
                if (frame >= CAROUSEL_PHASE1) { phase = 1; frame = 0; currentSetText = displayText; }
            } else {
                progress = frame / CAROUSEL_PHASE2;
                displayText = scrambleText(currentSetText, targetText, 1, progress, frame + CAROUSEL_PHASE1, scrambleSeed);
            }
            const items = track.querySelectorAll('.carousel-item');
            if (items.length > 0) items.forEach(item => { item.textContent = displayText; });
            else track.innerHTML = createContent(setNumberOrText, displayText) + createContent(setNumberOrText, displayText);
            if (phase === 0 || frame < CAROUSEL_PHASE2) { frame++; requestAnimationFrame(animate); }
            else currentSetText = targetText;
        }
        requestAnimationFrame(animate);
    }

    const first = sets[0];
    currentSetText = typeof first === 'string' ? first : carouselSets[first];
    track.innerHTML = createContent(first) + createContent(first);
    let currentIndex = 0;
    setInterval(() => {
        currentIndex = (currentIndex + 1) % sets.length;
        updateCarousel(sets[currentIndex]);
    }, intervalMs);
}
