/**
 * Project Files page: 3D box with iso cards; init() handles menu and carousel.
 * Card links use project list ids (URL ?id=).
 */
import { init, escapeHtml } from '../core.js';
import { getProjectList, fetchProjectList, saveProjectList } from '../storage.js';
import { navigateTo } from '../pageTransition.js';
import { projectUrlFor } from '../projectRoutes.js';
import { showLoadingScreen, hideLoadingScreen } from '../loadingScreen.js';

window.addEventListener('DOMContentLoaded', () => {
    showLoadingScreen('Project Files');
    init();
    fetchProjectList().then(list => { if (list && list.length) saveProjectList(list); }).then(() => {
    try {
    const projectList = getProjectList();
    const projectIds = projectList.map(p => String(p.id));
    const boxContainer = document.getElementById('boxContainer');
    const frontFace = boxContainer.querySelector('.front');
    const backFace = boxContainer.querySelector('.back');
    const rightFace = boxContainer.querySelector('.right');
    const leftFace = boxContainer.querySelector('.left');
    const topFace = boxContainer.querySelector('.top');
    const bottomFace = boxContainer.querySelector('.bottom');

        let boxWidth = 300;
        let boxLength = 200;
        let boxHeight = 300;
    let rotateX = -30;
    let rotateY = 45;
    let positionX = 0;
    let positionY = 0;
    let positionZ = 0;
    let isoCardCount = 3;
    let isoCardSpacing = 25;
    let scrollPosition = 0;
    let isoCardRepelDistance = 40;
    let isoCardRepelDuration = 0.3;
    let activeIsoCardElement = null;

    boxLength = Math.max(200, (isoCardCount * isoCardSpacing) + 100);

    const imagePaths = [
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1511497584788-876760111969?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=300&fit=crop'
    ];

    let lastMouseX = 0, lastMouseY = 0, mouseMoved = false, touchMoved = false;
    let previewedCard = null; // mobile: card that has been tapped once (preview); second tap opens

    /* ── Archive HUD: drawer label, file index, focused file ───────────── */
    const hud = {
        list: document.getElementById('pfIndexList'),
        count: document.getElementById('pfCount'),
        kicker: document.getElementById('pfFocusKicker'),
        name: document.getElementById('pfFocusName'),
        meta: document.getElementById('pfFocusMeta'),
        open: document.getElementById('pfFocusOpen'),
        rail: document.getElementById('pfRailFill')
    };
    const pad2 = (n) => String(n).padStart(2, '0');
    const mod = (n, m) => ((n % m) + m) % m;
    let focusSlot = -1;
    let lastFocusKey = '';

    function projectMeta(project) {
        if (!project) return 'Archive file';
        const discipline = project.discipline || (project.caseStudy && project.caseStudy.discipline);
        if (discipline) return discipline;
        return project.layout === 'story' ? 'Case study' : 'Deck';
    }

    function buildArchiveIndex() {
        if (!hud.list) return;
        hud.list.innerHTML = '';
        projectList.forEach((project, index) => {
            const item = document.createElement('li');
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'pf-file';
            button.dataset.projectId = String(project.id);
            button.innerHTML = `<span class="pf-file-no">${pad2(index + 1)}</span><span class="pf-file-name">${escapeHtml(project.name || 'Untitled')}</span>`;
            button.addEventListener('click', () => navigateTo(projectUrlFor(project.id, projectList)));
            item.appendChild(button);
            hud.list.appendChild(item);
        });
        if (hud.count) hud.count.textContent = pad2(projectList.length);
    }

    /** Which card sits nearest the drawer's read position (so the caption follows the deck). */
    function measureFocusSlot() {
        const cards = boxContainer.querySelectorAll('.front-duplicate');
        if (!cards.length || !isoCardCount) return;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const anchorX = vw <= 768 ? vw * 0.5 : vw * 0.6;
        const anchorY = vw <= 768 ? vh * 0.42 : vh * 0.5;
        let best = 0;
        let bestDist = Infinity;
        cards.forEach((card, index) => {
            const rect = card.getBoundingClientRect();
            if (!rect.width && !rect.height) return;
            const dx = rect.left + rect.width / 2 - anchorX;
            const dy = rect.top + rect.height / 2 - anchorY;
            const dist = dx * dx + dy * dy;
            if (dist < bestDist) {
                bestDist = dist;
                best = index;
            }
        });
        focusSlot = mod(best - Math.round(scrollPosition), isoCardCount);
        lastFocusKey = '';
    }

    function setArchiveFocus(projectId) {
        const index = projectList.findIndex(p => String(p.id) === String(projectId));
        const project = index >= 0 ? projectList[index] : null;
        if (!project) return;

        if (hud.kicker) hud.kicker.textContent = `Project ${pad2(index + 1)} of ${pad2(projectList.length)}`;
        if (hud.name) hud.name.textContent = project.name || 'Untitled';
        if (hud.meta) hud.meta.textContent = projectMeta(project);
        if (hud.open) hud.open.href = projectUrlFor(project.id, projectList);
        if (hud.rail) hud.rail.style.width = `${((index + 1) / Math.max(projectList.length, 1)) * 100}%`;

        document.querySelectorAll('.pf-file').forEach(row => {
            const isActive = row.dataset.projectId === String(project.id);
            row.classList.toggle('is-active', isActive);
            if (isActive) row.setAttribute('aria-current', 'true');
            else row.removeAttribute('aria-current');
        });

        // Keep the highlighted row inside the scrolling index (short viewports scroll it
        // vertically, phones scroll it horizontally). Uses scrollTop/Left so the page never moves.
        const activeRow = document.querySelector('.pf-file.is-active');
        const list = activeRow && activeRow.parentElement;
        if (activeRow && list) {
            const rowBox = activeRow.getBoundingClientRect();
            const listBox = list.getBoundingClientRect();
            if (list.scrollHeight > list.clientHeight + 1 && (rowBox.top < listBox.top || rowBox.bottom > listBox.bottom)) {
                list.scrollTop += rowBox.top - listBox.top - (listBox.height - rowBox.height) / 2;
            }
            if (list.scrollWidth > list.clientWidth + 1 && (rowBox.left < listBox.left || rowBox.right > listBox.right)) {
                list.scrollLeft += rowBox.left - listBox.left - (listBox.width - rowBox.width) / 2;
            }
        }
    }

    function syncArchiveFocus() {
        if (!projectList.length) return;
        if (focusSlot < 0) measureFocusSlot();
        if (focusSlot < 0) return;
        const cards = boxContainer.querySelectorAll('.front-duplicate');
        if (!cards.length) return;
        const hovered = activeIsoCardElement && activeIsoCardElement.isConnected ? activeIsoCardElement : null;
        const card = hovered || cards[mod(focusSlot + Math.round(scrollPosition), isoCardCount)];
        const projectId = card && card.getAttribute('data-project-id');
        if (!projectId) return;
        const key = `${projectId}|${hovered ? 'hover' : 'scroll'}`;
        if (key === lastFocusKey) return;
        lastFocusKey = key;
        setArchiveFocus(projectId);
    }

    buildArchiveIndex();

    /** Size card to image aspect ratio, capped by maxW x maxH (config width/height = max). */
    function sizeCardToImage(card, img, maxW, maxH) {
        if (!img.naturalWidth || !img.naturalHeight) return;
        const r = img.naturalWidth / img.naturalHeight;
        let w = maxW, h = maxH;
        if (r > maxW / maxH) h = maxW / r; else w = maxH * r;
        card.style.width = Math.round(w) + 'px';
        card.style.height = Math.round(h) + 'px';
    }

    function attachIsoCardHoverHandlers() {
        const frontDuplicates = boxContainer.querySelectorAll('.front-duplicate');
        frontDuplicates.forEach((isoCard) => {
            const newCard = isoCard.cloneNode(true);
            isoCard.parentNode.replaceChild(newCard, isoCard);
            newCard.addEventListener('mousedown', (e) => {
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
                mouseMoved = false;
            });
            newCard.addEventListener('mousemove', (e) => {
                if (Math.abs(e.clientX - lastMouseX) > 5 || Math.abs(e.clientY - lastMouseY) > 5) mouseMoved = true;
            });
            newCard.addEventListener('click', (e) => {
                if (!mouseMoved && !touchMoved) {
                    const projectId = newCard.getAttribute('data-project-id');
                    if (projectId) navigateTo(projectUrlFor(projectId, projectList));
                }
                mouseMoved = false;
                touchMoved = false;
            });
            newCard.addEventListener('touchstart', (e) => {
                if (e.touches.length === 1) {
                    lastMouseX = e.touches[0].clientX;
                    lastMouseY = e.touches[0].clientY;
                    touchMoved = false;
                }
            });
            newCard.addEventListener('touchmove', (e) => {
                if (e.touches.length === 1 && (Math.abs(e.touches[0].clientX - lastMouseX) > 5 || Math.abs(e.touches[0].clientY - lastMouseY) > 5)) touchMoved = true;
            });
            newCard.addEventListener('touchend', (e) => {
                if (!touchMoved && !scrollGestureUsed && e.changedTouches.length === 1) {
                    const projectId = newCard.getAttribute('data-project-id');
                    if (previewedCard === newCard) {
                        // Second tap: open project (card was already previewed)
                        if (projectId) { e.preventDefault(); navigateTo(projectUrlFor(projectId, projectList)); }
                        previewedCard = null;
                        activeIsoCardElement = null;
                        updateBox();
                        syncArchiveFocus();
                    } else {
                        // First tap: card preview (pop up + repel cards in front)
                        activeIsoCardElement = newCard;
                        previewedCard = newCard;
                        updateBox();
                        syncArchiveFocus();
                        e.preventDefault();
                    }
                }
                touchMoved = false;
            });
            newCard.addEventListener('mouseenter', () => {
                activeIsoCardElement = newCard;
                updateBox();
                syncArchiveFocus();
            });
            newCard.addEventListener('mouseleave', () => {
                activeIsoCardElement = null;
                updateBox();
                syncArchiveFocus();
            });
        });
    }

    function manageIsoCards() {
        const currentCards = boxContainer.querySelectorAll('.front-duplicate');
        const currentCount = currentCards.length;
        if (currentCount < isoCardCount) {
            for (let i = currentCount; i < isoCardCount; i++) {
                const newCard = document.createElement('div');
                newCard.className = 'box-face front-duplicate iso-card';
                newCard.setAttribute('data-duplicate', (i + 1).toString());
                newCard.setAttribute('data-project-id', projectIds.length ? projectIds[i % projectIds.length] : '');
                const img = document.createElement('img');
                const proj = projectList[i % projectList.length];
                img.src = (proj && (proj.deckThumbnail || proj.thumbnail)) ? (proj.deckThumbnail || proj.thumbnail) : imagePaths[i % imagePaths.length];
                img.alt = proj && proj.name ? proj.name : `Thumbnail ${(i % imagePaths.length) + 1}`;
                newCard.appendChild(img);
                boxContainer.insertBefore(newCard, backFace);
                newCard.addEventListener('wheel', handleWheelScroll, { passive: false });
                newCard.addEventListener('touchstart', handleTouchStart, { passive: true });
                newCard.addEventListener('touchmove', handleTouchMove, { passive: false });
                newCard.addEventListener('touchend', handleTouchEnd, { passive: true });
                newCard.addEventListener('touchcancel', handleTouchEnd, { passive: true });
            }
        } else if (currentCount > isoCardCount) {
            for (let i = currentCount - 1; i >= isoCardCount; i--) currentCards[i].remove();
        }
        const allCards = boxContainer.querySelectorAll('.front-duplicate');
        allCards.forEach((card, index) => {
            card.innerHTML = '';
            const img = document.createElement('img');
            const proj = projectList[index % projectList.length];
            img.src = (proj && (proj.deckThumbnail || proj.thumbnail)) ? (proj.deckThumbnail || proj.thumbnail) : imagePaths[index % imagePaths.length];
            img.alt = proj && proj.name ? proj.name : `Thumbnail ${(index % imagePaths.length) + 1}`;
            card.appendChild(img);
            if (projectList.length) {
                const plate = document.createElement('span');
                plate.className = 'iso-no';
                plate.textContent = pad2((index % projectList.length) + 1);
                card.appendChild(plate);
            }
            card.setAttribute('data-project-id', projectIds.length ? projectIds[index % projectIds.length] : '');
            img.addEventListener('load', () => sizeCardToImage(card, img, boxWidth, boxHeight));
            if (img.complete) sizeCardToImage(card, img, boxWidth, boxHeight);
        });
        attachIsoCardHoverHandlers();
        allCards.forEach(card => {
            card.addEventListener('wheel', handleWheelScroll, { passive: false });
            card.addEventListener('touchstart', handleTouchStart, { passive: true });
            card.addEventListener('touchmove', handleTouchMove, { passive: false });
            card.addEventListener('touchend', handleTouchEnd, { passive: true });
            card.addEventListener('touchcancel', handleTouchEnd, { passive: true });
        });
    }

    const centerTransform = 'translate(-50%, -50%)';

    /** Sets dimensions and builds card DOM. Call only when config or card count changes. */
    function applyBoxLayout() {
        const halfWidth = boxWidth / 2, halfLength = boxLength / 2, halfHeight = boxHeight / 2;
        frontFace.style.width = boxWidth + 'px';
        frontFace.style.height = boxHeight + 'px';
        frontFace.style.left = '50%';
        frontFace.style.top = '50%';
        manageIsoCards();
        const frontDuplicates = boxContainer.querySelectorAll('.front-duplicate');
        frontDuplicates.forEach((duplicate) => {
            duplicate.style.width = boxWidth + 'px';
            duplicate.style.height = boxHeight + 'px';
            duplicate.style.left = '50%';
            duplicate.style.top = '50%';
        });
        frontDuplicates.forEach((duplicate) => {
            const img = duplicate.querySelector('img');
            if (img && img.complete && img.naturalWidth && img.naturalHeight) sizeCardToImage(duplicate, img, boxWidth, boxHeight);
        });
        backFace.style.width = boxWidth + 'px';
        backFace.style.height = boxHeight + 'px';
        backFace.style.left = '50%';
        backFace.style.top = '50%';
        rightFace.style.width = boxLength + 'px';
        rightFace.style.height = boxHeight + 'px';
        rightFace.style.left = '50%';
        rightFace.style.top = '50%';
        leftFace.style.width = boxLength + 'px';
        leftFace.style.height = boxHeight + 'px';
        leftFace.style.left = '50%';
        leftFace.style.top = '50%';
        topFace.style.width = boxWidth + 'px';
        topFace.style.height = boxLength + 'px';
        topFace.style.left = '50%';
        topFace.style.top = '50%';
        bottomFace.style.width = boxWidth + 'px';
        bottomFace.style.height = boxLength + 'px';
        bottomFace.style.left = '50%';
        bottomFace.style.top = '50%';
    }

    /** Fit the whole deck inside narrow viewports without changing admin-authored dimensions. */
    function viewportScale() {
        const viewportWidth = Math.min(window.innerWidth, document.documentElement.clientWidth || window.innerWidth);
        const viewportHeight = Math.min(window.innerHeight, document.documentElement.clientHeight || window.innerHeight);
        if (!viewportWidth || !viewportHeight) return 1;
        const availableWidth = Math.max(200, viewportWidth - 48);
        const availableHeight = Math.max(160, viewportHeight * 0.5);
        return Math.min(1, availableWidth / Math.max(boxWidth, 1), availableHeight / Math.max(boxHeight, 1));
    }

    /** Updates only transforms (compositor-only, no layout). Call every frame during scroll. */
    function updateBox() {
        const scale = viewportScale();
        boxContainer.style.transform = `translate(-50%, -50%) translate3d(${positionX}px, ${positionY}px, ${positionZ}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`;
        const halfWidth = boxWidth / 2, halfLength = boxLength / 2, halfHeight = boxHeight / 2;

        frontFace.style.transform = `${centerTransform} rotateY(0deg) translateZ(${halfLength}px)`;

        const frontDuplicates = boxContainer.querySelectorAll('.front-duplicate');
        const activeIndex = activeIsoCardElement ? Array.from(frontDuplicates).indexOf(activeIsoCardElement) : -1;
        const activeBaseOffset = activeIndex >= 0 ? (() => {
            const v = (activeIndex - scrollPosition) % isoCardCount;
            const w = v < 0 ? v + isoCardCount : v;
            return halfLength - ((w + 1) * isoCardSpacing);
        })() : null;

        // Kill-and-regenerate: hide the one card that is wrapping (left the back, will reappear at the front, or vice versa).
        const frac = scrollPosition - Math.floor(scrollPosition);
        const isTransitioning = frac > 0.02 && frac < 0.98;
        const scrollingForward = targetScrollPosition > scrollPosition;
        const wrapHideIndex = isTransitioning
            ? (scrollingForward
                ? (Math.floor(scrollPosition) + isoCardCount - 1) % isoCardCount  // card that left the back
                : (Math.floor(scrollPosition) + isoCardCount) % isoCardCount)      // card that left the front
            : -1;

        frontDuplicates.forEach((duplicate, index) => {
            const virtualPosition = (index - scrollPosition) % isoCardCount;
            const wrappedPosition = virtualPosition < 0 ? virtualPosition + isoCardCount : virtualPosition;
            const offset = halfLength - ((wrappedPosition + 1) * isoCardSpacing);
            duplicate.dataset.baseOffset = offset;
            duplicate.style.transition = `transform ${isoCardRepelDuration}s ease`;
            const isKilled = wrapHideIndex >= 0 && index === wrapHideIndex;
            if (isKilled) {
                duplicate.style.visibility = 'hidden';
                duplicate.style.pointerEvents = 'none';
            } else {
                duplicate.style.visibility = '';
                duplicate.style.pointerEvents = '';
            }
            // Depth fade: files dissolve towards the back of the drawer.
            const fadeSpan = Math.max(1, isoCardCount - 1);
            const depthOpacity = 1 - 0.5 * (wrappedPosition / fadeSpan);
            duplicate.style.opacity = duplicate === activeIsoCardElement ? '1' : depthOpacity.toFixed(2);
            if (activeIndex >= 0) {
                const cardHeight = duplicate.offsetHeight || boxHeight;
                const popUpAmount = cardHeight * 0.9;
                if (duplicate === activeIsoCardElement) {
                    duplicate.style.transform = `${centerTransform} rotateY(0deg) translateZ(${offset}px) translateY(${-popUpAmount}px)`;
                } else if (activeBaseOffset != null && offset > activeBaseOffset) {
                    duplicate.style.transform = `${centerTransform} rotateY(0deg) translateZ(${offset + isoCardRepelDistance}px)`;
                } else {
                    duplicate.style.transform = `${centerTransform} rotateY(0deg) translateZ(${offset}px)`;
                }
            } else {
                duplicate.style.transform = `${centerTransform} rotateY(0deg) translateZ(${offset}px)`;
            }
        });

        backFace.style.transform = `${centerTransform} rotateY(180deg) translateZ(${halfLength}px)`;
        rightFace.style.transform = `${centerTransform} rotateY(90deg) translateZ(${halfWidth}px)`;
        leftFace.style.transform = `${centerTransform} rotateY(-90deg) translateZ(${halfWidth}px)`;
        topFace.style.transform = `${centerTransform} rotateX(90deg) translateZ(${halfHeight}px)`;
        bottomFace.style.transform = `${centerTransform} rotateX(-90deg) translateZ(${halfHeight}px)`;
    }

    function loadConfig(config) {
        if (config.width !== undefined) boxWidth = config.width;
        if (config.height !== undefined) boxHeight = config.height;
        if (config.isoCardCount !== undefined) isoCardCount = config.isoCardCount;
        if (config.isoCardSpacing !== undefined) isoCardSpacing = config.isoCardSpacing;
        if (config.isoCardRepelDistance !== undefined) isoCardRepelDistance = config.isoCardRepelDistance;
        if (config.isoCardRepelDuration !== undefined) isoCardRepelDuration = config.isoCardRepelDuration;
        if (config.rotateX !== undefined) rotateX = config.rotateX;
        if (config.rotateY !== undefined) rotateY = config.rotateY;
        if (config.positionX !== undefined) positionX = config.positionX;
        if (config.positionY !== undefined) positionY = config.positionY;
        if (config.positionZ !== undefined) positionZ = config.positionZ;
        boxLength = Math.max(200, (isoCardCount * isoCardSpacing) + 100);
        if (config.showFrontFace !== undefined) frontFace.style.display = config.showFrontFace ? 'flex' : 'none';
        if (config.showBackFace !== undefined) backFace.style.display = config.showBackFace ? 'flex' : 'none';
        if (config.showRightFace !== undefined) rightFace.style.display = config.showRightFace ? 'flex' : 'none';
        if (config.showLeftFace !== undefined) leftFace.style.display = config.showLeftFace ? 'flex' : 'none';
        if (config.showTopFace !== undefined) topFace.style.display = config.showTopFace ? 'flex' : 'none';
        if (config.showBottomFace !== undefined) bottomFace.style.display = config.showBottomFace ? 'flex' : 'none';
        applyBoxLayout();
        updateBox();
    }

    let targetScrollPosition = 0;
    const scrollSensitivity = 0.01;

    function modalIsOpen() {
        return document.body.classList.contains('site-modal-open');
    }

    function handleWheelScroll(e) {
        if (modalIsOpen()) return;
        // If the pointer is over the archive index and that list has more rows than fit, let the
        // browser scroll the list instead of pulling the drawer (matters when a studio has more
        // files than the viewport height).
        const indexList = e.target && e.target.closest ? e.target.closest('.pf-index ol') : null;
        if (indexList && indexList.scrollHeight > indexList.clientHeight + 1) return;
        e.preventDefault();
        e.stopPropagation();
        targetScrollPosition -= e.deltaY * scrollSensitivity;
        requestAnimationFrame(() => {
            scrollPosition += (targetScrollPosition - scrollPosition) * 0.1;
            updateBox();
        });
    }

    let touchStartY = 0, touchStartX = 0, isTouching = false;
    let scrollGestureUsed = false; // so card tap doesn't navigate after a scroll
    const touchSensitivity = 0.02;

    function handleTouchStart(e) {
        if (modalIsOpen()) return;
        if (e.touches.length === 1) {
            touchStartY = e.touches[0].clientY;
            touchStartX = e.touches[0].clientX;
            isTouching = true;
            // Tap outside cards: clear card preview (mobile)
            var t = e.target;
            if (!t || !t.closest || !t.closest('.front-duplicate')) {
                if (previewedCard) {
                    previewedCard = null;
                    activeIsoCardElement = null;
                    updateBox();
                }
            }
        }
    }

    function handleTouchMove(e) {
        if (modalIsOpen()) return;
        if (isTouching && e.touches.length === 1) {
            e.preventDefault();
            e.stopPropagation();
            const touchY = e.touches[0].clientY;
            const touchX = e.touches[0].clientX;
            const deltaY = touchStartY - touchY; // up = positive
            const deltaX = touchStartX - touchX;  // left-to-right = positive
            // Map both axes: left-to-right same as up-to-down, right-to-left same as down-to-up (inverted horizontal)
            const effectiveDelta = deltaY - deltaX;
            targetScrollPosition -= effectiveDelta * touchSensitivity;
            scrollGestureUsed = true;
            touchStartY = touchY;
            touchStartX = touchX;
        }
    }

    function handleTouchEnd() {
        isTouching = false;
        setTimeout(function () { scrollGestureUsed = false; }, 0);
    }

    const scene3d = document.querySelector('.scene-3d');
    const touchCapture = { passive: false };
    const touchStartOpt = { passive: true, capture: true };
    const touchMoveOpt = { passive: false, capture: true };
    const touchEndOpt = { passive: true, capture: true };
    window.addEventListener('wheel', handleWheelScroll, { passive: false });
    let resizeFocusTimer = 0;
    window.addEventListener('resize', () => {
        updateBox();
        clearTimeout(resizeFocusTimer);
        resizeFocusTimer = setTimeout(() => {
            // Framing is viewport-derived: reapply it so rotating a device or resizing a window
            // does not leave a desktop-scaled drawer on a phone-sized canvas (and vice versa).
            loadConfig(responsiveConfig(baseConfig));
            measureFocusSlot();
            syncArchiveFocus();
        }, 160);
    }, { passive: true });

    // Keyboard browsing: arrows / page keys pull the drawer, Enter opens the focused file.
    window.addEventListener('keydown', (e) => {
        if (modalIsOpen()) return;
        const tag = (e.target && e.target.tagName) || '';
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
        const step = e.shiftKey ? 4 : 1;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown') {
            e.preventDefault();
            targetScrollPosition += step;
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp') {
            e.preventDefault();
            targetScrollPosition -= step;
        } else if (e.key === 'Enter' && document.activeElement === document.body && hud.open) {
            e.preventDefault();
            navigateTo(hud.open.getAttribute('href'));
        }
    });
    if (scene3d) scene3d.addEventListener('wheel', handleWheelScroll, { passive: false });
    boxContainer.addEventListener('wheel', handleWheelScroll, { passive: false });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, touchCapture);
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    if (scene3d) {
        scene3d.addEventListener('touchstart', handleTouchStart, touchStartOpt);
        scene3d.addEventListener('touchmove', handleTouchMove, touchMoveOpt);
        scene3d.addEventListener('touchend', handleTouchEnd, touchEndOpt);
        scene3d.addEventListener('touchcancel', handleTouchEnd, touchEndOpt);
    }
    boxContainer.addEventListener('touchstart', handleTouchStart, touchStartOpt);
    boxContainer.addEventListener('touchmove', handleTouchMove, touchMoveOpt);
    boxContainer.addEventListener('touchend', handleTouchEnd, touchEndOpt);
    boxContainer.addEventListener('touchcancel', handleTouchEnd, touchEndOpt);
    [frontFace, backFace, rightFace, leftFace, topFace, bottomFace].forEach(face => {
        if (face) {
            face.addEventListener('wheel', handleWheelScroll, { passive: false });
            face.addEventListener('touchstart', handleTouchStart, touchStartOpt);
            face.addEventListener('touchmove', handleTouchMove, touchMoveOpt);
            face.addEventListener('touchend', handleTouchEnd, touchEndOpt);
            face.addEventListener('touchcancel', handleTouchEnd, touchEndOpt);
        }
    });

    function animateScroll() {
        // Faster settle (0.25): smooth scroll finishes in less time; reduces frames of heavy DOM work
        if (Math.abs(targetScrollPosition - scrollPosition) > 0.015) {
            scrollPosition += (targetScrollPosition - scrollPosition) * 0.25;
            updateBox();
            syncArchiveFocus();
        }
        requestAnimationFrame(animateScroll);
    }
    animateScroll();

    applyBoxLayout();
    updateBox();

    const PROJECT_FILES_CONFIG_KEY = 'project_files_3d_config';
    // Two full passes of the archive so the drawer never shows a gap and the order stays intact.
    const archiveCardCount = Math.max(8, (projectList.length || 4) * 2);
    const defaultConfig = {
        version: 2,
        width: 300,
        height: 225,
        isoCardCount: archiveCardCount,
        isoCardSpacing: 96,
        isoCardRepelDistance: 40,
        isoCardRepelDuration: 0.3,
        rotateX: -28,
        rotateY: -42,
        positionX: 300,
        positionY: 0,
        positionZ: -700,
        showFrontFace: false,
        showBackFace: false,
        showRightFace: false,
        showLeftFace: false,
        showTopFace: false,
        showBottomFace: true
    };

    /** Narrow screens need their own framing: smaller files, tighter drawer, more centred. */
    function responsiveConfig(config) {
        const vw = window.innerWidth;

        if (vw <= 768) {
            return {
                ...config,
                width: Math.round(config.width * 0.7),
                height: Math.round(config.height * 0.7),
                isoCardSpacing: Math.round(config.isoCardSpacing * 0.62),
                rotateX: -30,
                rotateY: -36,
                positionX: 150,
                positionY: -80,
                positionZ: -540
            };
        }

        // 769–1339px (portrait tablets, small laptop windows): the desktop drawer is wider than
        // the space left of the HUD column, so it would slide underneath the index. Shrink it and
        // nudge it right instead; both values interpolate so resizing stays smooth.
        if (vw < 1340) {
            const t = Math.min(1, Math.max(0, (vw - 820) / 520));
            const scale = 0.62 + 0.38 * t;
            return {
                ...config,
                width: Math.round(config.width * scale),
                height: Math.round(config.height * scale),
                isoCardSpacing: Math.round(config.isoCardSpacing * scale),
                positionX: Math.round(420 - 120 * t)
            };
        }

        return config;
    }

    // The unscaled config, shared across viewports. Responsive scaling is derived from it on
    // every layout pass — persisting the scaled values would compound the shrink per visit.
    let baseConfig = defaultConfig;

    function applyConfigAndShow(config) {
        if (!config || typeof config !== 'object') config = defaultConfig;
        baseConfig = { ...defaultConfig, ...config };
        try {
            loadConfig(responsiveConfig(baseConfig));
            measureFocusSlot();
            syncArchiveFocus();
            try { localStorage.setItem(PROJECT_FILES_CONFIG_KEY, JSON.stringify(baseConfig)); } catch (e) {}
        } catch (e) {
            baseConfig = defaultConfig;
            loadConfig(defaultConfig);
        }
        hideLoadingScreen();
    }
    fetch((window.__apiUrl || function(p){return p;})('/api/project-files-config'))
        .then(res => res.ok ? res.json() : { config: null })
        .then(data => {
            if (data && data.config && typeof data.config === 'object') return data.config;
            const raw = localStorage.getItem(PROJECT_FILES_CONFIG_KEY);
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === 'object' && parsed.version === defaultConfig.version) return parsed;
                } catch (e) {}
            }
            return defaultConfig;
        })
        .then(applyConfigAndShow)
        .catch(() => {
            try {
                const raw = localStorage.getItem(PROJECT_FILES_CONFIG_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === 'object' && parsed.version === defaultConfig.version) { applyConfigAndShow(parsed); return; }
                }
            } catch (e) {}
            applyConfigAndShow(defaultConfig);
        });
    } catch (e) {
        console.error('project-files init error:', e);
        hideLoadingScreen();
    }
    }).catch((e) => {
        console.error('project-files fetch error:', e);
        hideLoadingScreen();
    });
});
