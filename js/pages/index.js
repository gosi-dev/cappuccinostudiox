/**
 * Index page: interactive image, hotspots, admin access; init() handles menu and carousel.
 */
import { init } from '../core.js';
import { navigateTo } from '../pageTransition.js';
import { showLoadingScreenIfFirstVisit, markPageVisited, hideLoadingScreen } from '../loadingScreen.js';

const container = document.getElementById('imageContainer');
const image = document.getElementById('landscapeImage');
const hotspots = document.querySelectorAll('.hotspot');

// SECRET — REMOVED. The admin password used to be hardcoded here, which meant
// it shipped to every visitor in plain text. Admin access is now gated by
// ADMIN_TOKEN (Netlify env var) and verified server-side on every write; the
// admin pages ask for it in js/adminSession.js. Nothing secret lives in client
// code any more. The old value must be treated as compromised and rotated.
let nonInteractiveClickCount = 0;
document.addEventListener('click', function adminCheck(e) {
    if (e.target.closest('.navigation') || e.target.closest('.hotspot') || e.target.closest('.text-carousel') || e.target.closest('button') || e.target.closest('a')) {
        nonInteractiveClickCount = 0;
        return;
    }
    nonInteractiveClickCount++;
    if (nonInteractiveClickCount >= 7) {
        // Shortcut only: admin.html asks for the token and the API checks it.
        nonInteractiveClickCount = 0;
        navigateTo('admin.html');
    }
});

function sizeImageToViewport() {
    if (!image.complete || image.naturalWidth === 0) return;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
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

function gridToPercent(row, col, subRow, subCol) {
    const rowNum = parseInt(row);
    const colNum = col.charCodeAt(0) - 64;
    const subRowNum = parseInt(subRow.replace('R', ''));
    const subColNum = parseInt(subCol.replace('C', ''));
    const cellHeight = 100 / 8;
    const cellWidth = 100 / 15;
    const rowStart = (rowNum - 1) * cellHeight;
    const colStart = (colNum - 1) * cellWidth;
    const subRowHeight = cellHeight / 3;
    const subColWidth = cellWidth / 3;
    const subRowOffset = (subRowNum - 1) * subRowHeight;
    const subColOffset = (subColNum - 1) * subColWidth;
    const topPercent = rowStart + subRowOffset;
    const leftPercent = colStart + subColOffset;
    return { top: topPercent.toFixed(2), left: leftPercent.toFixed(2) };
}
window.gridToPercent = gridToPercent;

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
    const offsetX = imgRect.left - containerRect.left;
    const offsetY = imgRect.top - containerRect.top;
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
    const naturalWidth = image.naturalWidth;
    const naturalHeight = image.naturalHeight;
    const transform = getImageTransform();
    hotspots.forEach((hotspot, index) => {
        let naturalTop, naturalLeft;
        if (hotspot.dataset.x && hotspot.dataset.y) {
            naturalLeft = parseFloat(hotspot.dataset.x);
            naturalTop = parseFloat(hotspot.dataset.y);
        } else {
            const topPercent = hotspot.dataset.top || ['30', '60', '40'][index];
            const leftPercent = hotspot.dataset.left || ['25', '50', '75'][index];
            naturalTop = (parseFloat(topPercent) / 100) * naturalHeight;
            naturalLeft = (parseFloat(leftPercent) / 100) * naturalWidth;
        }
        const visibleNaturalWidth = transform.visibleWidth / transform.scale;
        const visibleNaturalHeight = transform.visibleHeight / transform.scale;
        const relativeTop = naturalTop - transform.cropY;
        const relativeLeft = naturalLeft - transform.cropX;
        const displayedTop = relativeTop * transform.scale + transform.offsetY;
        const displayedLeft = relativeLeft * transform.scale + transform.offsetX;
        hotspot.style.top = displayedTop + 'px';
        hotspot.style.left = displayedLeft + 'px';
    });
}

function centerImage() {
    if (!image.complete || image.naturalWidth === 0) return;
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

image.addEventListener('load', () => {
    updateHotspotPositions();
    setTimeout(() => centerImage(), 200);
});
window.addEventListener('resize', () => {
    updateHotspotPositions();
    updateSubtitleBoxWidths();
    fitOpenPopup();
    setTimeout(() => centerImage(), 200);
});
if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => fitOpenPopup());
}

let startX = 0, startY = 0, scrollLeft = 0, scrollTop = 0, isDown = false;
image.addEventListener('dragstart', (e) => { e.preventDefault(); return false; });
image.addEventListener('contextmenu', (e) => { e.preventDefault(); return false; });
container.addEventListener('dragstart', (e) => { e.preventDefault(); return false; });
container.addEventListener('dragover', (e) => { e.preventDefault(); return false; });
container.addEventListener('drop', (e) => { e.preventDefault(); return false; });
container.addEventListener('contextmenu', (e) => { e.preventDefault(); return false; });
container.addEventListener('wheel', (e) => { e.preventDefault(); }, { passive: false });

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

function closeAllHotspots() {
    document.querySelectorAll('.hotspot').forEach(hotspot => {
        hotspot.classList.remove('active');
        const box = hotspot.querySelector('.dialogue-box');
        if (box) {
            box.classList.remove('active');
            box.style.transform = '';
        }
        const button = hotspot.querySelector('.project-button');
        if (button) button.classList.remove('active');
    });
}

/**
 * Keep the open label inside the viewport. Phones pin the label under the header
 * (see the media query), so only wider screens need the nudge.
 */
function fitOpenPopup() {
    const box = document.querySelector('.dialogue-box.active');
    if (!box) return;
    box.style.transform = '';
    if (window.innerWidth <= 768) return;
    const rect = box.getBoundingClientRect();
    const margin = 20;
    let dx = 0;
    let dy = 0;
    if (rect.right > window.innerWidth - margin) dx = window.innerWidth - margin - rect.right;
    if (rect.left + dx < margin) dx = margin - rect.left;
    if (rect.bottom > window.innerHeight - margin) dy = window.innerHeight - margin - rect.bottom;
    if (rect.top + dy < margin) dy = margin - rect.top;
    if (dx || dy) box.style.transform = `translate(${Math.round(dx)}px, ${Math.round(dy)}px)`;
}

function openHotspot(hotspot) {
    hotspot.classList.add('active');
    const box = hotspot.querySelector('.dialogue-box');
    const button = hotspot.querySelector('.project-button');
    if (box) {
        box.classList.add('active');
        const subtitleBox = box.querySelector('.subtitle-box');
        if (subtitleBox) setTimeout(() => calculateSubtitleBoxWidth(subtitleBox), 10);
    }
    if (button) button.classList.add('active');
    requestAnimationFrame(fitOpenPopup);
}

// Tapping the probe ring itself does the same as tapping its eye icon.
function handleHotspotClick(id) {
    const hotspot = document.querySelector('.hotspot[data-hotspot="' + id + '"]')
        || document.querySelectorAll('.hotspot')[Number(id) - 1];
    if (!hotspot) return;
    const isCurrentlyActive = hotspot.classList.contains('active');
    closeAllHotspots();
    if (!isCurrentlyActive) openHotspot(hotspot);
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

function handleEyeClick(event, id) {
    event.stopPropagation();
    const clickedHotspot = event.target.closest('.hotspot');
    if (!clickedHotspot) return;
    const isCurrentlyActive = clickedHotspot.classList.contains('active');
    closeAllHotspots();
    if (!isCurrentlyActive) openHotspot(clickedHotspot);
}

let pressedButton = null;
document.querySelectorAll('.project-button').forEach(button => {
    const id = button.dataset.id;
    button.addEventListener('mousedown', (e) => { e.stopPropagation(); pressedButton = { button, id }; });
    button.addEventListener('mouseup', (e) => {
        e.stopPropagation();
        if (pressedButton && pressedButton.button === button) {
            // Keep the fade transition: navigateTo() is idempotent while the
            // page is already exiting, so the click handler below is harmless.
            navigateTo(button.dataset.page || 'project-files.html');
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
            e.preventDefault();
            navigateTo(button.dataset.page || 'project-files.html');
            pressedButton = null;
        }
    });
    button.addEventListener('touchcancel', () => { button.classList.remove('touch-active'); pressedButton = null; });
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        navigateTo(button.dataset.page || 'project-files.html');
    });
});

document.addEventListener('click', (e) => {
    if (e.target.closest('.project-button')) return;
    if (!e.target.closest('.hotspot') && !e.target.closest('.dialogue-box')) {
        closeAllHotspots();
    }
});

const showedLoader = showLoadingScreenIfFirstVisit('index.html', 'Landing');
init({
    onReady: () => {
        markPageVisited('index.html');
        if (showedLoader) hideLoadingScreen();
    }
});

if (image.complete) {
    updateHotspotPositions();
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
