/**
 * Render project content: apply CMS data, init gallery, init background videos.
 */
export const DEFAULT_GALLERY_ITEMS = [
    { type: 'image', src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop', name: 'MOUNTAIN LANDSCAPE.JPG', storyline: '' },
    { type: 'image', src: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1200&h=600&fit=crop', name: 'OCEAN VIEW.PNG', storyline: '' },
    { type: 'image', src: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=600&h=800&fit=crop', name: 'PORTRAIT SHOT.JPG', storyline: '' },
    { type: 'image', src: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=900&h=900&fit=crop', name: 'SQUARE IMAGE.PNG', storyline: '' },
    { type: 'image', src: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1600&h=900&fit=crop', name: 'WIDE FORMAT.JPG', storyline: '' },
    { type: 'image', src: 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=700&h=1000&fit=crop', name: 'VERTICAL SHOT.PNG', storyline: '' },
    { type: 'image', src: 'https://images.unsplash.com/photo-1511497584788-876760111969?w=1000&h=600&fit=crop', name: 'HORIZONTAL VIEW.JPG', storyline: '' },
    { type: 'image', src: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=1200&fit=crop', name: 'TALL PORTRAIT.PNG', storyline: '' }
];

/**
 * Mutate state with CMS data. state: { galleryItems, backgroundVideos, projectStoryline, projectStorylineTitle, projectName }
 */
export function applyCmsData(data, state, projectId) {
    if (!data || typeof data !== 'object') return;
    const storylineTitle = (data.storylineTitle != null && data.storylineTitle !== '') ? data.storylineTitle : data.storyline_title;
    if (data.storyline != null) state.projectStoryline = data.storyline || '';
    if (storylineTitle != null) state.projectStorylineTitle = storylineTitle || '';
    if (data.name != null) state.projectName = data.name || ('Project ' + projectId);
    const resolveSrc = (it) => {
        if (!it) return '';
        if (it.src) return it.src;
        const assetId = it.assetId != null ? it.assetId : it.asset_id;
        if (assetId == null || !Array.isArray(data.assets)) return '';
        const asset = data.assets.find(a => a && (a.id === assetId || a.assetId === assetId || a.asset_id === assetId));
        return (asset && asset.src) || '';
    };
    if (data.items != null && Array.isArray(data.items)) {
        state.galleryItems = data.items.map(it => {
            const src = resolveSrc(it);
            const type = String(it.type || 'image').toLowerCase();
            const itemStorylineTitle = (it.storylineTitle != null && it.storylineTitle !== '') ? it.storylineTitle : it.storyline_title;
            const backgroundRoster = it.backgroundRoster != null ? it.backgroundRoster : it.background_roster;
            const defaultBackgroundRoster = it.defaultBackgroundRoster != null ? it.defaultBackgroundRoster : it.default_background_roster;
            const base = { type, src, name: it.name || 'Untitled', trimStart: it.trimStart, trimEnd: it.trimEnd, storyline: it.storyline, storylineTitle: itemStorylineTitle ?? '', backgroundRoster: !!backgroundRoster, defaultBackgroundRoster: !!defaultBackgroundRoster };
            if (type === 'pdf') base.thumbnail = it.thumbnail || null;
            return base;
        }).filter(it => it.src);
        if (state.galleryItems.length > 0) {
            const rosterItems = state.galleryItems.filter(it => it.backgroundRoster && it.type !== 'pdf');
            state.backgroundVideos = rosterItems.length > 0 ? rosterItems.map(it => ({
                type: it.type,
                src: it.src,
                duration: it.type === 'image' ? 5000 : undefined,
                trimStart: it.trimStart,
                trimEnd: it.trimEnd
            })) : state.backgroundVideos;
            // Default background roster: used on first load (if no background roster) and when selected item is not on roster.
            const defaultItems = state.galleryItems.filter(it => it.defaultBackgroundRoster && it.type !== 'pdf');
            state.defaultBackgroundVideos = defaultItems.length > 0 ? defaultItems.map(it => ({
                type: it.type,
                src: it.src,
                duration: it.type === 'image' ? 5000 : undefined,
                trimStart: it.trimStart,
                trimEnd: it.trimEnd
            })) : [];
            if (state.backgroundVideos.length === 0 && state.defaultBackgroundVideos.length > 0) {
                state.backgroundVideos = state.defaultBackgroundVideos;
            }
        }
    }
    if (!state.defaultBackgroundVideos) state.defaultBackgroundVideos = [];
    if (state.galleryItems.length === 0) state.galleryItems = DEFAULT_GALLERY_ITEMS.slice();
    // Uploaded default background: shown on load and when no gallery item is selected.
    const defaultBgUrl = data.defaultBackgroundUrl || data.default_background_url;
    if (defaultBgUrl) {
        const isVideo = /\.(mp4|webm|ogg)(\?|$)/i.test(defaultBgUrl) || defaultBgUrl.startsWith('data:video');
        const entry = {
            src: defaultBgUrl,
            type: isVideo ? 'video' : 'image',
            duration: isVideo ? undefined : STACK_IMAGE_DURATION_MS
        };
        state.backgroundVideos = [entry];
        state.defaultBackgroundVideos = [entry];
    }
}

const STACK_IMAGE_DURATION_MS = 5000;

/**
 * Init background media in container. backgroundVideos: array of { src, trimStart?, trimEnd?, type?: 'video'|'image', duration?: number } or legacy string src.
 * Images (type === 'image' or entry.duration) are shown in a loop, each for duration ms (default 5s).
 * ref: { currentVideoIndex, getActiveItemIndex }.
 * @returns {{ restartCycle: () => void }} - call restartCycle() when returning to background (e.g. from expanded view) to restart image timer.
 */
export function initBackgroundVideos(containerId, backgroundVideos, ref) {
    const container = document.getElementById(containerId);
    if (!container) return { restartCycle: () => {} };
    container.innerHTML = '';
    const list = Array.isArray(backgroundVideos) ? backgroundVideos : [];
    if (list.length === 0) return { restartCycle: () => {} };
    let imageAdvanceTimer = null;

    function showNext(index) {
        if (ref.getActiveItemIndex && ref.getActiveItemIndex() !== null) return;
        const nextIndex = (index + 1) % list.length;
        ref.currentVideoIndex = nextIndex;
        const children = container.children;
        for (let i = 0; i < children.length; i++) children[i].classList.toggle('active', i === nextIndex);
        const nextEl = children[nextIndex];
        const nextEntry = list[nextIndex];
        if (nextEl && nextEntry) {
            // Lazy-load: assign src from data-src if not loaded yet
            if (!nextEl.src && nextEl.dataset.src) {
                nextEl.src = nextEl.dataset.src;
                delete nextEl.dataset.src;
            }
            if (nextEl.tagName === 'VIDEO') {
                const nextStart = typeof nextEntry === 'object' && nextEntry && nextEntry.trimStart != null ? nextEntry.trimStart : 0;
                nextEl.currentTime = nextStart;
                nextEl.play();
            } else {
                scheduleImageAdvance(nextIndex);
            }
        }
    }

    function scheduleImageAdvance(index) {
        if (imageAdvanceTimer) clearTimeout(imageAdvanceTimer);
        const entry = list[index];
        const duration = (typeof entry === 'object' && entry != null && entry.duration) ? entry.duration : STACK_IMAGE_DURATION_MS;
        imageAdvanceTimer = setTimeout(() => showNext(index), duration);
    }

    function restartCycle() {
        if (ref.getActiveItemIndex && ref.getActiveItemIndex() !== null) return;
        const idx = ref.currentVideoIndex != null ? ref.currentVideoIndex : 0;
        const el = container.children[idx];
        const entry = list[idx];
        if (el && entry && el.tagName !== 'VIDEO') scheduleImageAdvance(idx);
    }

    list.forEach((entry, index) => {
        const src = typeof entry === 'string' ? entry : (entry && entry.src);
        const trimStart = typeof entry === 'object' && entry != null ? entry.trimStart : undefined;
        const trimEnd = typeof entry === 'object' && entry != null ? entry.trimEnd : undefined;
        const isImage = (typeof entry === 'object' && entry != null && entry.type === 'image') || (typeof entry === 'object' && entry != null && entry.duration != null);
        if (!src) return;

        if (isImage) {
            const img = document.createElement('img');
            img.loading = 'lazy';
            img.decoding = 'async';
            img.fetchPriority = index === 0 ? 'high' : 'low';
            img.alt = '';
            img.className = 'background-video background-image';
            if (index === 0) {
                img.classList.add('active');
                img.src = src; // load first image eagerly
                scheduleImageAdvance(0);
            } else {
                img.dataset.src = src; // defer non-active images
            }
            container.appendChild(img);
            return;
        }

        const video = document.createElement('video');
        video.preload = index === 0 ? 'auto' : 'none'; // only preload first video
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.className = 'background-video';
        if (index === 0) {
            video.classList.add('active');
            video.src = src;
            video.autoplay = true;
        } else {
            video.dataset.src = src; // defer — load when it becomes active
        }
        container.appendChild(video);
        video.addEventListener('timeupdate', () => {
            if (trimEnd != null && isFinite(trimEnd) && video.currentTime >= trimEnd) {
                video.currentTime = trimStart != null && isFinite(trimStart) ? trimStart : 0;
            }
        });
        video.addEventListener('loadeddata', () => {
            if (trimStart != null && isFinite(trimStart)) video.currentTime = trimStart;
            if (video.classList.contains('active') && ref.getActiveItemIndex && ref.getActiveItemIndex() === null) video.play();
        });
        video.addEventListener('ended', () => {
            if (ref.getActiveItemIndex && ref.getActiveItemIndex() === null) {
                video.classList.remove('active');
                showNext(index);
            }
        });
    });
    return { restartCycle };
}

/**
 * Init gallery track. callbacks: { setHoverPreview(index), clearHoverPreview(), onItemClick(index, e?) }
 */
export function initGallery(trackId, containerId, galleryItems, callbacks) {
    const track = document.getElementById(trackId);
    const container = document.getElementById(containerId);
    if (!track || !container) return;
    track.innerHTML = '';
    const spacerStart = document.createElement('div');
    spacerStart.className = 'gallery-track-spacer gallery-track-spacer-start';
    track.appendChild(spacerStart);
    galleryItems.forEach((item, index) => {
        const galleryItem = document.createElement('div');
        galleryItem.className = 'gallery-item';
        galleryItem.dataset.index = index;
        if (item.type === 'pdf') galleryItem.dataset.type = 'pdf';
        let mediaElement;
        if (item.type === 'video') {
            mediaElement = document.createElement('video');
            mediaElement.preload = 'metadata'; // only load enough for a thumbnail frame, not the full video
            mediaElement.muted = true;
            mediaElement.playsInline = true;
            mediaElement.src = item.src;
        } else if (item.type === 'pdf') {
            mediaElement = document.createElement('img');
            mediaElement.loading = 'lazy';
            mediaElement.decoding = 'async';
            mediaElement.fetchPriority = 'low';
            mediaElement.src = item.thumbnail || item.src || '';
            mediaElement.alt = item.name;
        } else {
            mediaElement = document.createElement('img');
            mediaElement.loading = 'lazy';
            mediaElement.decoding = 'async';
            mediaElement.fetchPriority = 'low';
            mediaElement.src = item.src;
            mediaElement.alt = item.name;
        }
        const caption = document.createElement('div');
        caption.className = 'gallery-caption';
        const inner = document.createElement('div');
        inner.className = 'gallery-caption-inner';
        const captionText = document.createElement('span');
        captionText.className = 'gallery-caption-text';
        const nameStr = item.name != null ? String(item.name) : '';
        captionText.textContent = nameStr.includes('6969') ? '' : ((item.storylineTitle != null && String(item.storylineTitle).trim() !== '') ? String(item.storylineTitle).trim() : (item.name || ''));
        inner.appendChild(captionText);
        caption.appendChild(inner);
        galleryItem.appendChild(caption);
        const mediaWrap = document.createElement('div');
        mediaWrap.className = 'gallery-item-media';
        mediaWrap.appendChild(mediaElement);
        galleryItem.appendChild(mediaWrap);
        galleryItem.addEventListener('mouseenter', () => callbacks.setHoverPreview(index));
        galleryItem.addEventListener('click', (e) => callbacks.onItemClick(index, e));
        track.appendChild(galleryItem);
    });
    const spacerEnd = document.createElement('div');
    spacerEnd.className = 'gallery-track-spacer gallery-track-spacer-end';
    track.appendChild(spacerEnd);
    requestAnimationFrame(() => {
        const firstItem = track.querySelector('.gallery-item');
        if (firstItem) spacerStart.style.minWidth = (container.clientWidth / 2 - firstItem.offsetWidth / 2) + 'px';
        container.scrollLeft = 0;
    });
}
