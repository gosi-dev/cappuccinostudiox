/**
 * Project page: state, callbacks, runInits; init() loads project and runs runAfterLoad.
 */
import { init } from '../core.js';
import { getProjectIdFromURL } from '../projectLoader.js';
import { createStorylineController } from '../animations.js';
import { setupMenuSimple } from '../ui.js';
import { showLoadingScreen, hideLoadingScreen } from '../loadingScreen.js';
import { initBackgroundVideos as rendererInitBg, initGallery as rendererInitGallery, DEFAULT_GALLERY_ITEMS } from '../projectRenderer.js';

const projectId = getProjectIdFromURL();
if (!projectId) {
    document.body.innerHTML = '<p style="padding:40px;font-family:sans-serif;">Missing project id.</p><a href="project-files.html" style="color:#FFF212;">Back to Project Files</a>';
    throw new Error('missing id');
}

const state = {
    galleryItems: DEFAULT_GALLERY_ITEMS.slice(),
    backgroundVideos: [],
    defaultBackgroundVideos: [],
    projectStoryline: '',
    projectStorylineTitle: '',
    projectName: 'Project ' + projectId
};

let currentVideoIndex = 0;
let activeItemIndex = null;
const storylineController = createStorylineController();
const contentViewOverlay = document.getElementById('contentViewOverlay');
const contentViewInner = document.getElementById('contentViewInner');
let contentViewMedia = null;
let backgroundController = { restartCycle: () => {} };

const ref = {
    get currentVideoIndex() { return currentVideoIndex; },
    set currentVideoIndex(v) { currentVideoIndex = v; },
    getActiveItemIndex: () => activeItemIndex
};

function buildExpandedMedia(item) {
    let el;
    if (item.type === 'video') {
        el = document.createElement('video');
        el.src = item.src;
        el.autoplay = true;
        el.loop = true;
        el.muted = item.audioEnabled !== true;
        if (item.audioEnabled === true) el.volume = 1;
        el.playsInline = true;
        const trimStart = item.trimStart != null && isFinite(item.trimStart) ? item.trimStart : 0;
        const trimEnd = item.trimEnd != null && isFinite(item.trimEnd) ? item.trimEnd : null;
        el.addEventListener('loadeddata', () => { el.currentTime = trimStart; });
        if (trimEnd != null) {
            el.addEventListener('timeupdate', () => { if (el.currentTime >= trimEnd) el.currentTime = trimStart; });
        }
    } else if (item.type === 'pdf') {
        el = document.createElement('img');
        el.src = item.thumbnail || item.src || '';
        el.alt = item.name;
    } else {
        el = document.createElement('img');
        el.src = item.src;
        el.alt = item.name;
    }
    return el;
}

/** Build expanded-background element from a defaultBackgroundVideos entry ({ type, src, trimStart?, trimEnd? }). */
function buildExpandedMediaFromDefaultEntry(entry) {
    if (!entry || !entry.src) return null;
    const isVideo = entry.type === 'video';
    if (isVideo) {
        const el = document.createElement('video');
        el.src = entry.src;
        el.autoplay = true;
        el.loop = true;
        el.muted = true;
        el.playsInline = true;
        const trimStart = entry.trimStart != null && isFinite(entry.trimStart) ? entry.trimStart : 0;
        const trimEnd = entry.trimEnd != null && isFinite(entry.trimEnd) ? entry.trimEnd : null;
        el.addEventListener('loadeddata', () => { el.currentTime = trimStart; });
        if (trimEnd != null) {
            el.addEventListener('timeupdate', () => { if (el.currentTime >= trimEnd) el.currentTime = trimStart; });
        }
        return el;
    }
    const img = document.createElement('img');
    img.src = entry.src;
    img.alt = '';
    return img;
}

/** Caption text = storyline title (fallback item name). In preview mode (active item) we show TAP TO OPEN for all types. Blank if item name contains 6969. */
function getCaptionText(item, usePdfCta) {
    if (!item) return '';
    if (item.name != null && String(item.name).includes('6969')) return '';
    if (usePdfCta) return 'TAP TO OPEN';
    return (item.storylineTitle != null && String(item.storylineTitle).trim() !== '') ? String(item.storylineTitle).trim() : (item.name || '');
}
/** Set caption for one gallery item. */
function setGalleryCaptionForIndex(index, usePdfCta) {
    const el = document.querySelector('.gallery-item[data-index="' + index + '"]');
    const item = state.galleryItems[index];
    const cap = el && el.querySelector('.gallery-caption-text');
    if (!cap || !item) return;
    cap.textContent = getCaptionText(item, usePdfCta);
}
/** Restore all gallery captions to storyline title / name. */
function restoreGalleryCaptions() {
    state.galleryItems.forEach((item, i) => setGalleryCaptionForIndex(i, false));
}

const DEFAULT_RED_BG = '#E70017';

/** Desktop only: show item in expanded background (or default background / red if item not on background roster). No-op when in preview mode. */
function setHoverPreview(index) {
    if (window.matchMedia('(max-width: 768px)').matches) return;
    if (activeItemIndex !== null) return; /* don't hijack preview mode */
    const item = state.galleryItems[index];
    if (!item) return;
    const expandedBg = document.getElementById('expandedBackground');
    if (!expandedBg) return;
    document.querySelectorAll('.background-video').forEach(v => { v.classList.remove('active'); if (v.pause) v.pause(); });
    expandedBg.innerHTML = '';
    expandedBg.style.backgroundColor = '';
    if (item.backgroundRoster) {
        expandedBg.appendChild(buildExpandedMedia(item));
    } else if (state.defaultBackgroundVideos && state.defaultBackgroundVideos.length > 0) {
        const defaultEl = buildExpandedMediaFromDefaultEntry(state.defaultBackgroundVideos[0]);
        if (defaultEl) expandedBg.appendChild(defaultEl);
        else expandedBg.style.backgroundColor = DEFAULT_RED_BG;
    } else {
        expandedBg.style.backgroundColor = DEFAULT_RED_BG;
    }
    expandedBg.classList.add('active');
    document.querySelectorAll('.gallery-item').forEach(el => {
        if (String(el.dataset.index) !== String(index)) el.classList.add('gallery-item-hover-hidden');
        else el.classList.remove('gallery-item-hover-hidden');
    });
    state.galleryItems.forEach((_, i) => setGalleryCaptionForIndex(i, i === index));
}

/** Clear hover preview when leaving gallery; no-op if in full preview mode. */
function clearHoverPreview() {
    if (activeItemIndex !== null) return;
    restoreGalleryCaptions();
    document.querySelectorAll('.gallery-item').forEach(el => el.classList.remove('gallery-item-hover-hidden'));
    const expandedBg = document.getElementById('expandedBackground');
    if (!expandedBg) return;
    expandedBg.innerHTML = '';
    expandedBg.style.backgroundColor = '';
    expandedBg.classList.remove('active');
    const videos = document.querySelectorAll('.background-video');
    let foundActive = false;
    videos.forEach((el, i) => {
        if (el.classList.contains('active')) { foundActive = true; currentVideoIndex = i; if (el.play) el.play(); }
    });
    if (!foundActive && videos.length > 0) {
        currentVideoIndex = 0;
        videos[0].classList.add('active');
        if (videos[0].currentTime !== undefined) videos[0].currentTime = 0;
        if (videos[0].play) videos[0].play();
    }
    backgroundController.restartCycle();
}

/** First click/tap = preview mode; second on same item = content view. */
function onGalleryItemClick(index, e) {
    if (e) e.stopPropagation();
    if (activeItemIndex === index) {
        openContentView(index);
    } else {
        setActiveItem(index);
    }
}

function setActiveItem(index) {
    const item = state.galleryItems[index];
    if (!item) return;
    activeItemIndex = index;
    const expandedBg = document.getElementById('expandedBackground');
    const allItems = document.querySelectorAll('.gallery-item');
    const storylineEl = document.getElementById('storylineOverlay');
    document.querySelectorAll('.background-video').forEach(v => { v.classList.remove('active'); if (v.pause) v.pause(); });
    expandedBg.innerHTML = '';
    expandedBg.style.backgroundColor = '';
    if (item.backgroundRoster) {
        expandedBg.appendChild(buildExpandedMedia(item));
    } else if (state.defaultBackgroundVideos && state.defaultBackgroundVideos.length > 0) {
        const defaultEl = buildExpandedMediaFromDefaultEntry(state.defaultBackgroundVideos[0]);
        if (defaultEl) expandedBg.appendChild(defaultEl);
        else expandedBg.style.backgroundColor = DEFAULT_RED_BG;
    } else {
        expandedBg.style.backgroundColor = DEFAULT_RED_BG;
    }
    expandedBg.classList.add('active');
    /* Clear all state classes so Chrome applies the new active item correctly when switching preview */
    allItems.forEach(el => {
        el.classList.remove('hidden', 'gallery-item-hover-hidden', 'gallery-item-media-reveal');
    });
    allItems.forEach((el, i) => { el.classList.toggle('hidden', i !== index); });
    state.galleryItems.forEach((_, i) => setGalleryCaptionForIndex(i, i === index));
    /* Force Chrome to apply visibility: read layout so next paint shows the correct item */
    const activeEl = allItems[index];
    if (activeEl) void activeEl.offsetHeight;
    if (storylineEl) {
        storylineEl.classList.add('visible');
        /* Storyline title = item caption (title/name), not the PDF instruction; gallery caption alone shows TAP/CLICK TO OPEN PDF */
        const storylineTitleStr = getCaptionText(item, false);
        const hasTitle = storylineTitleStr !== '' && !String(storylineTitleStr).includes('6969');
        const itemStory = (item.storyline != null && String(item.storyline).trim() !== '') ? String(item.storyline).trim() : '';
        const body = itemStory || formatProjectStoryline();
        const text = hasTitle ? (body ? storylineTitleStr + '\n\n' + body : storylineTitleStr) : body;
        storylineController.run(storylineEl, (text || '').toUpperCase());
        storylineController.setupHoverReveal(storylineEl);
    }
}

function formatProjectStoryline() {
    const title = (state.projectStorylineTitle || '').trim();
    const body = (state.projectStoryline || '').trim();
    return title ? (body ? title + '\n\n' + body : title) : body;
}

function resetToBackground() {
    if (activeItemIndex === null) return;
    activeItemIndex = null;
    const expandedBg = document.getElementById('expandedBackground');
    const allItems = document.querySelectorAll('.gallery-item');
    const videos = document.querySelectorAll('.background-video');
    let foundActive = false;
    videos.forEach((el, index) => {
        if (el.classList.contains('active')) { foundActive = true; currentVideoIndex = index; if (el.play) el.play(); }
    });
    if (!foundActive && videos.length > 0) {
        currentVideoIndex = 0;
        videos[0].classList.add('active');
        if (videos[0].currentTime !== undefined) videos[0].currentTime = 0;
        if (videos[0].play) videos[0].play();
    }
    expandedBg.classList.remove('active');
    expandedBg.style.backgroundColor = '';
    allItems.forEach(item => item.classList.remove('hidden'));
    restoreGalleryCaptions();
    backgroundController.restartCycle();
    const storylineEl = document.getElementById('storylineOverlay');
    if (storylineEl && (state.projectStorylineTitle || state.projectStoryline)) {
        storylineEl.classList.add('visible');
        storylineController.run(storylineEl, formatProjectStoryline().toUpperCase());
        storylineController.setupHoverReveal(storylineEl);
    }
}

// PDF.js is vendored under js/vendor/pdfjs (Apache-2.0, see NOTICE) so the page
// no longer pulls a script from cdnjs — that removed the last third-party script
// origin and lets script-src stay 'self'.
const PDFJS_CDN = (window.__BASE_PATH || '') + '/js/vendor/pdfjs';
let pdfjsLib = null;

/**
 * Load PDF.js and render into container. Progress updates loadingBarInner (width %). Content shown only when complete.
 * Returns { pdf, baseViewport, renderAtScale }. Default scale = min(fitWidth, fitHeight) so full page fits.
 */
async function loadAndRenderPdfWithPdfJs(pdfUrl, container, loadingBarInner) {
    if (!pdfjsLib) {
        const mod = await import(/* webpackIgnore: true */ PDFJS_CDN + '/pdf.min.mjs');
        pdfjsLib = mod.default ?? mod;
        if (pdfjsLib.GlobalWorkerOptions) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_CDN + '/pdf.worker.min.mjs';
        }
    }
    const loadingTask = pdfjsLib.getDocument({ url: pdfUrl });
    if (loadingBarInner && loadingTask.onProgress !== undefined) {
        loadingTask.onProgress = (data) => {
            const pct = data.total > 0 ? Math.min(100, (100 * data.loaded) / data.total) : 0;
            loadingBarInner.style.width = pct + '%';
        };
    }
    const pdf = await loadingTask.promise;
    if (loadingBarInner) loadingBarInner.style.width = '100%';
    const numPages = pdf.numPages;
    const firstPage = await pdf.getPage(1);
    const baseViewport = firstPage.getViewport({ scale: 1 });
    const dpr = Math.min(3, window.devicePixelRatio || 1);

    async function renderAtScale(scaleLogical) {
        const scale = scaleLogical * dpr;
        container.querySelectorAll('.content-view-pdf-page-canvas').forEach(c => c.remove());
        for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            canvas.className = 'content-view-pdf-page-canvas';
            const ctx = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: ctx, viewport }).promise;
            canvas.style.width = (viewport.width / dpr) + 'px';
            canvas.style.height = (viewport.height / dpr) + 'px';
            container.appendChild(canvas);
        }
        requestAnimationFrame(() => initPdfScrollbar());
    }

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const gap = isMobile ? 16 : 32;
    const sb = isMobile ? 9 : 12;
    const maxW = (isMobile ? (window.innerWidth - (2 * window.innerWidth / 12) - gap - sb) : (0.9 * window.innerWidth - gap - sb)) || 400;
    const maxH = (isMobile ? (window.innerHeight - (2 * window.innerHeight / 12)) : (0.9 * window.innerHeight)) || 500;
    const scaleW = maxW / baseViewport.width;
    const scaleH = maxH / baseViewport.height;
    const scaleLogical = Math.min(scaleW, scaleH);
    await renderAtScale(scaleLogical);
    return { pdf, baseViewport, renderAtScale };
}

function createToolbarSep() {
    const sep = document.createElement('span');
    sep.className = 'content-view-pdf-toolbar-sep';
    return sep;
}

function createToolbarBtn(title, label, onClick) {
    const btn = document.createElement('button');
    btn.className = 'content-view-pdf-toolbar-btn';
    btn.type = 'button';
    btn.title = title;
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
}

let pdfScrollbarAbort = null;

function initPdfScrollbar() {
    const scrollOuter = document.getElementById('contentViewPdfScrollOuter');
    const scrollbarEl = scrollOuter?.querySelector('.content-view-custom-scrollbar');
    const track = scrollOuter?.querySelector('.content-view-scrollbar-track');
    const thumb = scrollOuter?.querySelector('.content-view-scrollbar-thumb');
    if (!scrollOuter || !scrollbarEl || !track || !thumb || !contentViewInner) return;

    pdfScrollbarAbort?.abort();
    pdfScrollbarAbort = new AbortController();
    const { signal } = pdfScrollbarAbort;

    const isPdfView = contentViewOverlay.classList.contains('content-view-pdf-active');
    const thumbSize = isPdfView && window.matchMedia('(max-width: 768px)').matches ? 9 : (isPdfView ? 12 : 6);

    function update() {
        const canScroll = contentViewInner.scrollHeight > contentViewInner.clientHeight;
        scrollbarEl.style.display = canScroll ? 'block' : 'none';
        if (!canScroll) return;
        const maxScroll = contentViewInner.scrollHeight - contentViewInner.clientHeight;
        const trackHeight = track.clientHeight;
        const thumbTop = maxScroll <= 0 ? 0 : (contentViewInner.scrollTop / maxScroll) * (trackHeight - thumbSize);
        thumb.style.top = thumbTop + 'px';
    }

    contentViewInner.addEventListener('scroll', update, { signal });
    const ro = new ResizeObserver(update);
    ro.observe(contentViewInner);
    signal.addEventListener('abort', () => ro.disconnect(), { once: true });

    track.addEventListener('click', (e) => {
        if (e.target === thumb) return;
        const maxScroll = contentViewInner.scrollHeight - contentViewInner.clientHeight;
        if (maxScroll <= 0) return;
        const trackRect = track.getBoundingClientRect();
        const y = (e.clientY - trackRect.top - thumbSize / 2) / (trackRect.height - thumbSize);
        const rel = Math.max(0, Math.min(1, y));
        contentViewInner.scrollTop = rel * maxScroll;
    }, { signal });

    function drag(startY, startScrollTop) {
        const maxScroll = contentViewInner.scrollHeight - contentViewInner.clientHeight;
        if (maxScroll <= 0) return;
        function move(e) {
            const y = e.touches ? e.touches[0].clientY : e.clientY;
            const trackRect = track.getBoundingClientRect();
            const rel = (trackRect.height - thumbSize) > 0
                ? (y - trackRect.top - thumbSize / 2) / (trackRect.height - thumbSize)
                : 0;
            contentViewInner.scrollTop = Math.max(0, Math.min(maxScroll, rel * maxScroll));
        }
        function end() {
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', end);
            document.removeEventListener('touchmove', move, { passive: false });
            document.removeEventListener('touchend', end);
            document.removeEventListener('touchcancel', end);
        }
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', end);
        document.addEventListener('touchmove', move, { passive: false });
        document.addEventListener('touchend', end);
        document.addEventListener('touchcancel', end);
    }

    thumb.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); drag(e.clientY, contentViewInner.scrollTop); }, { signal });
    thumb.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); drag(e.touches[0].clientY, contentViewInner.scrollTop); }, { passive: false, signal });

    update();
}

function openContentView(index) {
    const item = state.galleryItems[index];
    if (!item) return;
    contentViewInner.innerHTML = '';
    const isMobile = window.matchMedia('(max-width: 768px)').matches;

    if (item.type === 'pdf') {
        // Only same-origin paths, https URLs and blob: handles reach the PDF
        // viewer / fallback iframe; javascript: or data: documents are refused.
        const pdfUrl = /^(https?:\/\/|blob:|\/(?!\/)|[A-Za-z0-9._~-]+\/)/i.test(item.src || '') ? item.src : '';
        if (!pdfUrl) {
            contentViewInner.innerHTML = '<p class="content-view-error">This document link is not allowed.</p>';
            return;
        }
        const wrap = document.createElement('div');
        wrap.className = 'content-view-pdf-wrap content-view-pdf-content-hidden';
        const container = document.createElement('div');
        container.className = 'content-view-pdf-canvas-container';
        wrap.appendChild(container);

        const loadingWrap = document.createElement('div');
        loadingWrap.className = 'content-view-pdf-loading-wrap';
        const loadingBlock = document.createElement('div');
        loadingBlock.className = 'content-view-pdf-loading-block';
        const loadingBarOuter = document.createElement('div');
        loadingBarOuter.className = 'content-view-pdf-loading-bar-outer';
        const loadingBarInner = document.createElement('div');
        loadingBarInner.className = 'content-view-pdf-loading-bar-inner';
        loadingBarOuter.appendChild(loadingBarInner);
        loadingBlock.appendChild(loadingBarOuter);
        const loadingText = document.createElement('div');
        loadingText.className = 'content-view-pdf-loading-text';
        loadingText.textContent = 'LOADING FILE...';
        loadingBlock.appendChild(loadingText);
        loadingWrap.appendChild(loadingBlock);

        const toolbar = document.createElement('div');
        toolbar.className = 'content-view-pdf-toolbar content-view-pdf-toolbar-hidden';
        const closeBtn = document.createElement('button');
        closeBtn.className = 'content-view-pdf-toolbar-btn';
        closeBtn.type = 'button';
        closeBtn.title = 'Close';
        closeBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
        closeBtn.addEventListener('click', closeContentView);
        toolbar.appendChild(closeBtn);
        toolbar.appendChild(createToolbarSep());
        toolbar.appendChild(createToolbarBtn('Zoom out', '−', () => { if (window.__pdfScale) { window.__pdfScale = Math.max(0.25, window.__pdfScale / 1.2); window.__pdfRender(window.__pdfScale); } }));
        toolbar.appendChild(createToolbarBtn('Zoom in', '+', () => { if (window.__pdfScale) { window.__pdfScale = Math.min(4, window.__pdfScale * 1.2); window.__pdfRender(window.__pdfScale); } }));

        contentViewOverlay.appendChild(loadingWrap);
        contentViewOverlay.appendChild(toolbar);
        contentViewInner.appendChild(wrap);
        contentViewOverlay.classList.add('active');
        contentViewOverlay.classList.add('content-view-pdf-active');
        contentViewOverlay.classList.add('content-view-pdf-canvas-mode');

        function showToolbar() {
            toolbar.classList.remove('content-view-pdf-toolbar-hidden');
            if (contentViewOverlay._pdfToolbarHideTimeout) clearTimeout(contentViewOverlay._pdfToolbarHideTimeout);
            contentViewOverlay._pdfToolbarHideTimeout = setTimeout(() => toolbar.classList.add('content-view-pdf-toolbar-hidden'), 5000);
        }
        const pdfActivityEvents = ['mousemove', 'touchmove', 'scroll', 'click'];
        pdfActivityEvents.forEach(ev => contentViewOverlay.addEventListener(ev, showToolbar, { passive: true }));
        contentViewOverlay._pdfToolbarShowToolbar = showToolbar;
        contentViewOverlay._pdfToolbarActivityEvents = pdfActivityEvents;

        loadAndRenderPdfWithPdfJs(pdfUrl, container, loadingBarInner).then(({ baseViewport, renderAtScale }) => {
            loadingWrap.remove();
            wrap.classList.remove('content-view-pdf-content-hidden');
            contentViewOverlay.classList.add('content-view-pdf-loaded');
            window.__pdfScale = Math.min(
                (container.clientWidth || 400) / baseViewport.width,
                (container.clientHeight || 500) / baseViewport.height
            );
            window.__pdfRender = renderAtScale;
            showToolbar();
            requestAnimationFrame(() => initPdfScrollbar());
        }).catch(() => {
            contentViewOverlay.classList.remove('content-view-pdf-canvas-mode');
            loadingWrap.remove();
            toolbar.remove();
            wrap.remove();
            contentViewInner.innerHTML = '';
            const iframe = document.createElement('iframe');
            iframe.src = pdfUrl;
            iframe.title = item.name || 'PDF';
            iframe.className = 'content-view-pdf-iframe';
            contentViewInner.appendChild(iframe);
            const closeBtn = document.createElement('button');
            closeBtn.className = 'content-view-close-fixed';
            closeBtn.type = 'button';
            closeBtn.title = 'Close';
            closeBtn.textContent = 'Close';
            closeBtn.addEventListener('click', closeContentView);
            contentViewOverlay.appendChild(closeBtn);
        });
        return;
    }

    const isVideo = item.type === 'video';
    const media = isVideo ? document.createElement('video') : document.createElement('img');
    media.src = item.src;
    if (isVideo) {
        media.controls = false;
        media.muted = item.audioEnabled !== true;
        if (item.audioEnabled === true) media.volume = 1;
        media.playsInline = true;
        media.loop = true;
        const trimStart = item.trimStart != null && isFinite(item.trimStart) ? item.trimStart : 0;
        const trimEnd = item.trimEnd != null && isFinite(item.trimEnd) ? item.trimEnd : null;
        media.addEventListener('loadeddata', () => { media.currentTime = trimStart; });
        if (trimEnd != null) {
            media.addEventListener('timeupdate', () => {
                if (media.currentTime >= trimEnd) media.currentTime = trimStart;
            });
        }
    } else { media.alt = item.name; }
    contentViewMedia = media;
    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    if (isMobile) {
        wrap.className = 'content-view-mobile-wrap';
        media.style.maxWidth = '100%';
        media.style.width = 'calc(100% - 1rem)';
        media.style.margin = '0 auto';
        media.style.display = 'block';
    }
    wrap.appendChild(media);
    const actions = document.createElement('div');
    actions.className = 'content-view-actions';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'content-view-btn';
    closeBtn.type = 'button';
    closeBtn.title = 'Close';
    closeBtn.innerHTML = '&#10005;';
    closeBtn.addEventListener('click', closeContentView);
    actions.appendChild(closeBtn);
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'content-view-btn';
    fullscreenBtn.type = 'button';
    fullscreenBtn.title = 'Full screen';
    fullscreenBtn.innerHTML = '&#9744;';
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) contentViewOverlay.requestFullscreen().catch(() => {});
        else document.exitFullscreen();
    });
    actions.appendChild(fullscreenBtn);
    if (isVideo) {
        const playBtn = document.createElement('button');
        playBtn.className = 'content-view-btn';
        playBtn.type = 'button';
        playBtn.title = 'Play / Pause';
        playBtn.innerHTML = '&#9658;';
        playBtn.addEventListener('click', () => {
            if (media.paused) { media.play(); playBtn.innerHTML = '&#10074;&#10074;'; } else { media.pause(); playBtn.innerHTML = '&#9658;'; }
        });
        media.addEventListener('play', () => { playBtn.innerHTML = '&#10074;&#10074;'; });
        media.addEventListener('pause', () => { playBtn.innerHTML = '&#9658;'; });
        actions.appendChild(playBtn);
        media.play();
    }
    wrap.appendChild(actions);
    contentViewInner.appendChild(wrap);
    contentViewOverlay.classList.add('active');
}

function closeContentView() {
    if (contentViewMedia && contentViewMedia.pause) contentViewMedia.pause();
    contentViewMedia = null;
    if (contentViewOverlay._pdfToolbarHideTimeout) {
        clearTimeout(contentViewOverlay._pdfToolbarHideTimeout);
        contentViewOverlay._pdfToolbarHideTimeout = null;
    }
    const showToolbarFn = contentViewOverlay._pdfToolbarShowToolbar;
    const activityEvents = contentViewOverlay._pdfToolbarActivityEvents;
    if (showToolbarFn && activityEvents) {
        activityEvents.forEach(ev => contentViewOverlay.removeEventListener(ev, showToolbarFn));
        contentViewOverlay._pdfToolbarShowToolbar = null;
        contentViewOverlay._pdfToolbarActivityEvents = null;
    }
    contentViewOverlay.querySelector('.content-view-pdf-loading-wrap')?.remove();
    contentViewOverlay.classList.remove('active');
    contentViewOverlay.classList.remove('content-view-pdf-active');
    contentViewOverlay.classList.remove('content-view-pdf-loaded');
    contentViewOverlay.classList.remove('content-view-pdf-canvas-mode');
    contentViewOverlay.querySelectorAll('.content-view-close-fixed').forEach(el => el.remove());
    const toolbarEl = document.querySelector('.content-view-pdf-toolbar');
    if (toolbarEl) toolbarEl.remove();
    pdfScrollbarAbort?.abort();
    pdfScrollbarAbort = null;
    window.__pdfScale = null;
    window.__pdfRender = null;
    if (document.fullscreenElement) document.exitFullscreen();
}

function runInits() {
    try {
        const out = rendererInitBg('backgroundVideos', state.backgroundVideos, ref);
        if (out && out.restartCycle) backgroundController = out;
    } catch (e) { console.error('initBackgroundVideos', e); }
    try {
        rendererInitGallery('galleryTrack', 'galleryContainer', state.galleryItems, {
            setHoverPreview,
            clearHoverPreview,
            onItemClick: onGalleryItemClick
        });
    } catch (e) { console.error('initGallery', e); }
    const menuText = document.getElementById('projectMenuText');
    if (menuText) menuText.textContent = (state.projectName || ('Project ' + projectId)).toUpperCase();
    document.title = 'Cappuccino Studiox';
    if (state.projectStorylineTitle || state.projectStoryline) {
        const el = document.getElementById('storylineOverlay');
        if (el) {
            el.classList.add('visible');
            storylineController.run(el, formatProjectStoryline().toUpperCase());
            storylineController.setupHoverReveal(el);
        }
    }

    const galleryContainer = document.getElementById('galleryContainer');
    if (galleryContainer) {
        galleryContainer.addEventListener('mouseleave', () => {
            if (activeItemIndex !== null) return; /* keep preview mode when leaving gallery; only click-away or another item deactivates */
            clearHoverPreview();
        });
        /* mouseover fallback for browsers where mouseenter doesn't fire on gallery items (e.g. Cursor) */
        galleryContainer.addEventListener('mouseover', (e) => {
            const item = e.target.closest('.gallery-item');
            if (item && activeItemIndex === null) setHoverPreview(Number(item.dataset.index));
        });
        galleryContainer.addEventListener('mouseenter', (e) => {
            const item = e.target.closest('.gallery-item');
            if (item && activeItemIndex !== null && Number(item.dataset.index) !== activeItemIndex) {
                item.classList.add('gallery-item-media-reveal');
            }
        }, true);
        galleryContainer.addEventListener('mouseleave', (e) => {
            const item = e.target.closest('.gallery-item');
            if (item) item.classList.remove('gallery-item-media-reveal');
        }, true);
    }
    document.addEventListener('wheel', (e) => {
        const gallery = document.getElementById('galleryContainer');
        if (!gallery) return;
        if (contentViewOverlay.contains(e.target)) return; /* don't steal scroll when in content view (PDF/image) */
        const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
        gallery.scrollLeft += delta;
        e.preventDefault();
    }, { passive: false });
    document.addEventListener('click', (e) => {
        if (activeItemIndex !== null && !e.target.closest('.gallery-item') && !e.target.closest('.expanded-background') && !e.target.closest('.gallery-container')) resetToBackground();
    });
    document.addEventListener('touchend', (e) => {
        if (activeItemIndex !== null && !e.target.closest('.gallery-item') && !e.target.closest('.expanded-background') && !e.target.closest('.gallery-container')) resetToBackground();
    });

    contentViewOverlay.addEventListener('click', (e) => { if (e.target === contentViewOverlay) closeContentView(); });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || !contentViewOverlay.classList.contains('active')) return;
        if (document.fullscreenElement) document.exitFullscreen();
        else closeContentView();
    });

    setupMenuSimple('projectMenuContainer', 'projectMenuButton');

    /* Wait for first visible content to load before hiding loading screen */
    const maxWaitMs = 4000;
    const minWaitMs = 400;
    const start = Date.now();
    function hideWhenReady() {
        hideLoadingScreen({ label: state.projectName || ('Project ' + projectId) });
    }
    function tryHide() {
        if (Date.now() - start >= minWaitMs) hideWhenReady();
        else setTimeout(hideWhenReady, minWaitMs - (Date.now() - start));
    }
    const bg = document.getElementById('backgroundVideos');
    const gallery = document.getElementById('galleryContainer');
    const firstBg = bg && (bg.querySelector('.background-video') || bg.querySelector('.background-image'));
    const firstGalleryImg = gallery && gallery.querySelector('.gallery-item img, .gallery-item video');
    let resolved = false;
    function done() {
        if (resolved) return;
        resolved = true;
        tryHide();
    }
    if (firstBg) {
        if (firstBg.tagName === 'VIDEO') firstBg.addEventListener('loadeddata', done, { once: true });
        else firstBg.addEventListener('load', done, { once: true });
    }
    if (firstGalleryImg) {
        if (firstGalleryImg.tagName === 'VIDEO') firstGalleryImg.addEventListener('loadeddata', done, { once: true });
        else firstGalleryImg.addEventListener('load', done, { once: true });
    }
    if (!firstBg && !firstGalleryImg) {
        tryHide();
    } else {
        setTimeout(done, maxWaitMs);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        showLoadingScreen('Project');
        init({ projectPage: { projectId, state, runAfterLoad: runInits } });
    });
} else {
    showLoadingScreen('Project');
    init({ projectPage: { projectId, state, runAfterLoad: runInits } });
}
