/**
 * Kitchen page: interactive image, hotspots; init() handles menu and carousel.
 */
import { init } from '../core.js';
import { navigateTo } from '../pageTransition.js';
import { showLoadingScreenIfFirstVisit, markPageVisited, hideLoadingScreen } from '../loadingScreen.js';

const container = document.getElementById('imageContainer');
const image = document.getElementById('landscapeImage');
const hotspots = document.querySelectorAll('.hotspot');

const TICKER_GAP = 6;      // red space kept between the ticker and the scene
const SCENE_PAD = 32;      // breathing room around the outermost probes, in screen px

/**
 * Phone layout: the kitchen is cropped into the band between the ticker strip
 * and the offer sheet. Fit the probe cluster (not the whole 1986px scene) into
 * that band, so every probe is on screen, below the header, above the sheet and
 * comfortably tappable, while the kitchen still reads as a room behind them.
 */
function probeClusterBounds() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    hotspots.forEach((hotspot) => {
        const x = parseFloat(hotspot.dataset.x);
        const y = parseFloat(hotspot.dataset.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
    });
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
    return { minX, minY, maxX, maxY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

function sizeSceneAboveSheet() {
    if (!image.complete || image.naturalWidth === 0) return;
    const panel = document.querySelector('.offer-panel');
    const sheetTop = panel ? Math.round(panel.getBoundingClientRect().top) : window.innerHeight;
    // The ticker sits in the red strip above the scene; the band starts under it.
    const ticker = document.querySelector('.text-carousel');
    const tickerBottom = ticker ? Math.round(ticker.getBoundingClientRect().bottom) : 116;
    const bandTop = Math.max(0, tickerBottom + TICKER_GAP);
    const bandHeight = Math.max(80, sheetTop - bandTop);

    container.style.top = bandTop + 'px';
    container.style.height = bandHeight + 'px';
    container.style.overflow = 'hidden';
    container.scrollLeft = 0;
    container.scrollTop = 0;

    const cluster = probeClusterBounds();
    if (!cluster) return;
    const bandWidth = container.clientWidth || window.innerWidth;
    const usableWidth = Math.max(80, bandWidth - SCENE_PAD * 2);
    const usableHeight = Math.max(80, bandHeight - SCENE_PAD * 2);
    const scale = Math.min(usableWidth / cluster.width, usableHeight / cluster.height);

    // Place the image so the cluster centre lands on the band centre.
    const displayedWidth = image.naturalWidth * scale;
    const displayedHeight = image.naturalHeight * scale;
    const left = Math.round(bandWidth / 2 - ((cluster.minX + cluster.maxX) / 2) * scale);
    const top = Math.round(bandHeight / 2 - ((cluster.minY + cluster.maxY) / 2) * scale);

    image.style.position = 'absolute';
    image.style.width = displayedWidth.toFixed(3) + 'px';
    image.style.height = displayedHeight.toFixed(3) + 'px';
    image.style.minWidth = '0';
    image.style.minHeight = '0';
    image.style.maxWidth = 'none';
    image.style.maxHeight = 'none';
    image.style.objectPosition = 'center center';
    image.style.left = Math.min(0, Math.max(bandWidth - displayedWidth, left)) + 'px';
    image.style.top = Math.min(0, Math.max(bandHeight - displayedHeight, top)) + 'px';
    image.style.marginTop = '0';
}

function resetScenePositioning() {
    container.style.top = '';
    container.style.height = '';
    image.style.position = '';
    image.style.left = '';
    image.style.top = '';
    image.style.maxWidth = '';
    image.style.maxHeight = '';
    image.style.marginTop = '';
}

function sizeImageToViewport() {
    if (!image.complete || image.naturalWidth === 0) return;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    if (viewportWidth <= 768) {
        sizeSceneAboveSheet();
        return;
    }
    resetScenePositioning();
    const imageAspectRatio = image.naturalWidth / image.naturalHeight;
    const viewportAspectRatio = viewportWidth / viewportHeight;
    if (imageAspectRatio > viewportAspectRatio) {
        container.style.overflowX = 'scroll';
        container.style.overflowY = 'hidden';
        image.style.width = 'auto';
        image.style.height = '100vh';
        image.style.minWidth = '100vw';
        image.style.objectPosition = 'center center';
    } else {
        container.style.overflowX = 'hidden';
        container.style.overflowY = 'scroll';
        image.style.width = '100vw';
        image.style.height = 'auto';
        image.style.minHeight = '100vh';
        image.style.objectPosition = 'center center';
    }
}

function getImageTransform() {
    if (!image.complete || image.naturalWidth === 0) {
        return { scale: 1, offsetX: 0, offsetY: 0, visibleWidth: 0, visibleHeight: 0, cropX: 0, cropY: 0 };
    }
    const naturalWidth = image.naturalWidth;
    const naturalHeight = image.naturalHeight;
    const imgRect = image.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const displayedWidth = imgRect.width;
    const displayedHeight = imgRect.height;
    /*
     * Probes are absolutely positioned inside the scrolling container, so their
     * left/top live in content space, not viewport space. Add the scroll offset
     * back: without it the measurement is off by however far the scene happened
     * to be panned when we measured, and every probe drifts off its feature on
     * resize (and while panning).
     */
    const offsetX = imgRect.left - containerRect.left + container.scrollLeft;
    const offsetY = imgRect.top - containerRect.top + container.scrollTop;
    const naturalAspect = naturalWidth / naturalHeight;
    const displayedAspect = displayedWidth / displayedHeight;
    let scale, visibleNaturalWidth, visibleNaturalHeight, cropX, cropY;
    if (naturalAspect > displayedAspect) {
        scale = displayedHeight / naturalHeight;
        visibleNaturalHeight = naturalHeight;
        visibleNaturalWidth = displayedWidth / scale;
        cropX = (naturalWidth - visibleNaturalWidth) / 2;
        cropY = 0;
    } else {
        scale = displayedWidth / naturalWidth;
        visibleNaturalWidth = naturalWidth;
        visibleNaturalHeight = displayedHeight / scale;
        cropX = 0;
        cropY = (naturalHeight - visibleNaturalHeight) / 2;
    }
    return { scale, offsetX, offsetY, visibleWidth: displayedWidth, visibleHeight: displayedHeight, cropX, cropY };
}

function updateHotspotPositions() {
    sizeImageToViewport();
    if (!image.complete || image.naturalWidth === 0) return;
    const transform = getImageTransform();
    hotspots.forEach((hotspot) => {
        if (hotspot.dataset.x && hotspot.dataset.y) {
            const naturalLeft = parseFloat(hotspot.dataset.x);
            const naturalTop = parseFloat(hotspot.dataset.y);
            const visibleNaturalWidth = transform.visibleWidth / transform.scale;
            const visibleNaturalHeight = transform.visibleHeight / transform.scale;
            const relativeTop = naturalTop - transform.cropY;
            const relativeLeft = naturalLeft - transform.cropX;
            const displayedTop = relativeTop * transform.scale + transform.offsetY;
            const displayedLeft = relativeLeft * transform.scale + transform.offsetX;
            hotspot.style.top = displayedTop + 'px';
            hotspot.style.left = displayedLeft + 'px';
        }
    });
}

function centerImage() {
    if (!image.complete || image.naturalWidth === 0) return;
    // Phones frame the scene around the probes instead (see sizeSceneAboveSheet).
    if (window.innerWidth <= 768) return;
    const centerScroll = () => {
        if (container.scrollWidth === 0 || container.scrollHeight === 0) {
            setTimeout(centerScroll, 50);
            return;
        }
        const imageAspectRatio = image.naturalWidth / image.naturalHeight;
        const viewportAspectRatio = window.innerWidth / window.innerHeight;
        if (imageAspectRatio > viewportAspectRatio) {
            const scrollableWidth = container.scrollWidth - container.clientWidth;
            if (scrollableWidth > 0) container.scrollLeft = scrollableWidth / 2;
        } else {
            const scrollableHeight = container.scrollHeight - container.clientHeight;
            if (scrollableHeight > 0) container.scrollTop = scrollableHeight / 2;
        }
    };
    requestAnimationFrame(() => requestAnimationFrame(centerScroll));
}

function calculateSubtitleBoxWidth(subtitleBox) {
    // Phones pin the label to the viewport width (see the media query); the
    // ch-based fitting below would shrink it back to a machine-measured box.
    if (window.innerWidth <= 768) {
        subtitleBox.style.width = '100%';
        subtitleBox.style.whiteSpace = 'normal';
        return;
    }
    const originalWidth = subtitleBox.style.width;
    subtitleBox.style.width = 'auto';
    subtitleBox.style.whiteSpace = 'nowrap';
    const text = subtitleBox.textContent.trim();
    if (!text) {
        subtitleBox.style.width = originalWidth;
        subtitleBox.style.whiteSpace = 'normal';
        return;
    }
    const words = text.split(' ');
    const isMobile = window.innerWidth <= 768;
    const padding = isMobile ? 24 : 40;
    const maxWidth = isMobile ? 240 : 560;
    let longestLineLength = 0;
    let currentLine = '';
    words.forEach(word => {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        subtitleBox.textContent = testLine;
        const testWidth = subtitleBox.offsetWidth - padding - 4;
        if (testWidth > maxWidth && currentLine) {
            longestLineLength = Math.max(longestLineLength, currentLine.length);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    });
    if (currentLine) longestLineLength = Math.max(longestLineLength, currentLine.length);
    subtitleBox.textContent = text;
    subtitleBox.style.whiteSpace = 'normal';
    subtitleBox.style.width = `calc(${longestLineLength}ch + ${padding}px + 4px)`;
}

function updateSubtitleBoxWidths() {
    document.querySelectorAll('.subtitle-box').forEach(box => calculateSubtitleBoxWidth(box));
}

const POPUP_GAP = 20;    // distance between a probe and its popup (mirrors the CSS)
const POPUP_EDGE = 16;   // breathing room kept between a popup and the frame edge

function hotspotById(id) {
    if (id === undefined || id === null) return null;
    return document.querySelector('.hotspot[data-hotspot="' + id + '"]');
}

function resetPopupFit() {
    document.querySelectorAll('.dialogue-box').forEach(box => {
        box.style.left = '';
        box.style.right = '';
        box.style.top = '';
    });
    document.querySelectorAll('.hotspot>.project-button').forEach(button => {
        button.style.left = '';
        button.style.right = '';
        button.style.top = '';
    });
    document.querySelectorAll('.hotspot.flip').forEach(hotspot => hotspot.classList.remove('flip'));
}

function popupBounds(popup) {
    const parts = popup.classList.contains('dialogue-box')
        ? Array.from(popup.children).filter(el => el.getBoundingClientRect().width > 0)
        : [popup];
    if (!parts.length) return popup.getBoundingClientRect();
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    parts.forEach(part => {
        const r = part.getBoundingClientRect();
        left = Math.min(left, r.left);
        top = Math.min(top, r.top);
        right = Math.max(right, r.right);
        bottom = Math.max(bottom, r.bottom);
    });
    return { left, top, right, bottom, width: right - left, height: bottom - top };
}

/**
 * Keep the open popup inside the visible scene. The offer panel narrows the
 * kitchen, so probes near the right edge flip their label to the left; anything
 * still hanging over an edge is nudged back in on both axes.
 */
function fitOpenPopup() {
    // Phones pin the label card under the header (see the media query); only a
    // bare probe button still needs nudging back inside the frame.
    if (window.innerWidth <= 768 && !document.querySelector('.hotspot>.project-button.active')) return;
    resetPopupFit();
    const activeBox = document.querySelector('.dialogue-box.active');
    const activeButton = activeBox ? null : document.querySelector('.hotspot>.project-button.active');
    const popup = activeBox || activeButton;
    if (!popup) return;
    const hotspot = popup.closest('.hotspot');
    if (!hotspot) return;

    const isBox = popup.classList.contains('dialogue-box');
    const frame = container.getBoundingClientRect();
    const maxRight = frame.right - POPUP_EDGE;
    const minLeft = frame.left + POPUP_EDGE;

    let rect = popupBounds(popup);
    if (rect.right > maxRight) {
        hotspot.classList.add('flip');
        rect = popupBounds(popup);
    }

    let dx = 0;
    if (rect.right > maxRight) dx = rect.right - maxRight;
    if (rect.left - dx < minLeft) dx = rect.left - minLeft;
    // A label wider than the frame would fight both edges; keep it inside on the right.
    if (rect.right - dx > maxRight) dx = rect.right - maxRight;
    if (dx !== 0) {
        if (hotspot.classList.contains('flip')) {
            popup.style.right = 'calc(50% + ' + (POPUP_GAP + dx) + 'px)';
        } else {
            popup.style.left = 'calc(50% + ' + (POPUP_GAP - dx) + 'px)';
        }
    }

    rect = popupBounds(popup);
    let dy = 0;
    const maxBottom = frame.bottom - POPUP_EDGE;
    if (rect.bottom > maxBottom) dy = rect.bottom - maxBottom;
    if (rect.top - dy < POPUP_EDGE) dy = rect.top - POPUP_EDGE;
    if (dy !== 0) {
        // A dialogue box sits 10px above its probe; a bare probe button is centred on it.
        popup.style.top = isBox ? 'calc(-10px - ' + dy + 'px)' : 'calc(50% - ' + dy + 'px)';
    }
}

function closeAllHotspots() {
    document.querySelectorAll('.hotspot').forEach(hotspot => {
        hotspot.classList.remove('active');
        const box = hotspot.querySelector('.dialogue-box');
        if (box) box.classList.remove('active');
        const button = hotspot.querySelector('.project-button');
        if (button) button.classList.remove('active');
    });
    resetPopupFit();
}

function openHotspot(hotspot) {
    hotspot.classList.add('active');
    const box = hotspot.querySelector('.dialogue-box');
    const button = hotspot.querySelector('.project-button');
    if (box) box.classList.add('active');
    if (button) button.classList.add('active');
    requestAnimationFrame(() => {
        const subtitleBox = box ? box.querySelector('.subtitle-box') : null;
        if (subtitleBox) calculateSubtitleBoxWidth(subtitleBox);
        fitOpenPopup();
    });
}

function handleEyeClick(event, id) {
    if (event) event.stopPropagation();
    const hotspot = hotspotById(id) || (event && event.target.closest ? event.target.closest('.hotspot') : null);
    if (!hotspot) return;
    const isCurrentlyActive = hotspot.classList.contains('active');
    closeAllHotspots();
    if (!isCurrentlyActive) openHotspot(hotspot);
}

function handleHotspotClick(id) {
    const hotspot = hotspotById(id);
    if (!hotspot) return;
    const isCurrentlyActive = hotspot.classList.contains('active');
    closeAllHotspots();
    if (!isCurrentlyActive) openHotspot(hotspot);
}

if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
        updatePositions();
        fitOpenPopup();
    });
}

function updatePositions() {
    sizeImageToViewport();
    updateHotspotPositions();
}

image.addEventListener('load', () => {
    updatePositions();
    setTimeout(() => centerImage(), 200);
});
/*
 * Resizing fires in bursts while a window edge is dragged. Measure once per
 * frame, then once more after the resize settles (layout, webfonts and the
 * centred pan have finished by then), so the probes never land on a stale
 * image rect.
 */
let resizeFrame = 0;
let resizeSettle = 0;
function handleResize() {
    if (!resizeFrame) {
        resizeFrame = requestAnimationFrame(() => {
            resizeFrame = 0;
            updatePositions();
            updateSubtitleBoxWidths();
            fitOpenPopup();
        });
    }
    clearTimeout(resizeSettle);
    resizeSettle = setTimeout(() => {
        updatePositions();
        fitOpenPopup();
        centerImage();
    }, 180);
}
window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', handleResize);

let startX = 0, startY = 0, scrollLeft = 0, scrollTop = 0, isDown = false;
image.addEventListener('dragstart', (e) => { e.preventDefault(); return false; });
image.addEventListener('contextmenu', (e) => { e.preventDefault(); return false; });
container.addEventListener('dragstart', (e) => { e.preventDefault(); return false; });
container.addEventListener('dragover', (e) => { e.preventDefault(); return false; });
container.addEventListener('drop', (e) => { e.preventDefault(); return false; });
container.addEventListener('contextmenu', (e) => { e.preventDefault(); return false; });

container.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('hotspot') || e.target.classList.contains('project-button') || e.target.classList.contains('eye-icon') || e.target.closest('.project-button') || e.target.closest('.eye-icon')) return;
    isDown = true;
    const rect = container.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    scrollLeft = container.scrollLeft;
    scrollTop = container.scrollTop;
    container.style.cursor = 'grabbing';
});
container.addEventListener('mouseleave', () => { isDown = false; container.style.cursor = 'grab'; });
container.addEventListener('mouseup', () => { isDown = false; container.style.cursor = 'grab'; });
container.addEventListener('mousemove', (e) => {
    if (!isDown) { container.style.cursor = 'grab'; return; }
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    container.scrollLeft = scrollLeft - (x - startX) * 2;
    container.scrollTop = scrollTop - (y - startY) * 2;
});
container.style.cursor = 'grab';

let touchStartX = 0, touchStartY = 0, touchScrollLeft = 0, touchScrollTop = 0, isTouching = false;
container.addEventListener('touchstart', (e) => {
    if (e.target.classList.contains('hotspot') || e.target.classList.contains('project-button') || e.target.closest('.project-button')) return;
    isTouching = true;
    const rect = container.getBoundingClientRect();
    touchStartX = e.touches[0].clientX - rect.left;
    touchStartY = e.touches[0].clientY - rect.top;
    touchScrollLeft = container.scrollLeft;
    touchScrollTop = container.scrollTop;
}, { passive: false });
container.addEventListener('touchmove', (e) => {
    if (!isTouching) return;
    if (e.target.classList.contains('hotspot') || e.target.classList.contains('project-button') || e.target.closest('.project-button')) return;
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const y = e.touches[0].clientY - rect.top;
    container.scrollLeft = touchScrollLeft - (x - touchStartX);
    container.scrollTop = touchScrollTop - (y - touchStartY);
}, { passive: false });
container.addEventListener('touchend', () => { isTouching = false; });
container.addEventListener('touchcancel', () => { isTouching = false; });
container.addEventListener('wheel', (e) => { e.preventDefault(); }, { passive: false });

function closeActiveHotspot() {
    closeAllHotspots();
}

let pressedButton = null;
document.querySelectorAll('.project-button').forEach(button => {
    const id = button.dataset.id;
    const modal = button.dataset.modal;
    const page = button.dataset.page;
    button.addEventListener('mousedown', (e) => { e.stopPropagation(); pressedButton = { button, id }; });
    button.addEventListener('mouseup', (e) => {
        e.stopPropagation();
        if (pressedButton && pressedButton.button === button) {
            if (modal && typeof window.openModal === 'function') {
                window.openModal(modal);
                closeActiveHotspot();
            } else if (page) navigateTo(page);
            else alert('Project button ' + id + ' clicked! Navigate to next page.');
            pressedButton = null;
        }
    });
    button.addEventListener('mouseleave', () => { pressedButton = null; });
    button.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        e.preventDefault();
        pressedButton = { button, id };
        button.classList.add('touch-active');
    });
    button.addEventListener('touchend', (e) => {
        e.stopPropagation();
        button.classList.remove('touch-active');
        if (pressedButton && pressedButton.button === button) {
            if (modal && typeof window.openModal === 'function') {
                e.preventDefault();
                window.openModal(modal);
                closeActiveHotspot();
            } else if (page) { e.preventDefault(); navigateTo(page); }
            else { e.preventDefault(); alert('Project button ' + id + ' clicked! Navigate to next page.'); }
            pressedButton = null;
        }
    });
    button.addEventListener('touchcancel', () => { button.classList.remove('touch-active'); pressedButton = null; });
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        if (modal && typeof window.openModal === 'function') {
            window.openModal(modal);
            closeActiveHotspot();
        } else if (page) navigateTo(page);
        else alert('Project button ' + id + ' clicked! Navigate to next page.');
    });
});

document.addEventListener('click', (e) => {
    if (e.target.closest('.project-button')) return;
    if (!e.target.closest('.hotspot') && !e.target.closest('.dialogue-box')) {
        closeAllHotspots();
    }
});

/*
 * The offer sheet is sized by its own content, so its top edge can move after
 * we have measured it (webfont swap, reflow). Re-frame the scene when it does.
 */
let sheetObserver = null;
function observeSheet() {
    const panel = document.querySelector('.offer-panel');
    if (!panel || typeof ResizeObserver === 'undefined' || sheetObserver) return;
    sheetObserver = new ResizeObserver(() => {
        if (window.innerWidth <= 768) updatePositions();
    });
    sheetObserver.observe(panel);
}

const showedLoader = showLoadingScreenIfFirstVisit('kitchen.html', 'Kitchen');
init({
    onReady: () => {
        markPageVisited('kitchen.html');
        if (showedLoader) hideLoadingScreen();
        observeSheet();
        updatePositions();
    }
});

if (image.complete) {
    updatePositions();
    setTimeout(() => centerImage(), 200);
}
updateSubtitleBoxWidths();

window.handleHotspotClick = handleHotspotClick;
window.handleEyeClick = handleEyeClick;

// Bind hotspots in JS instead of inline onclick attributes so the page can run
// under a CSP with script-src 'self' (no 'unsafe-inline').
document.querySelectorAll('.hotspot').forEach(hotspot => {
    const id = Number(hotspot.dataset.hotspot);
    hotspot.addEventListener('click', () => handleHotspotClick(id));
    const eye = hotspot.querySelector('.eye-icon');
    if (eye) eye.addEventListener('click', event => handleEyeClick(event, id));
});
