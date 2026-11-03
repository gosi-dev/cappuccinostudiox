/**
 * Scramble animation and storyline (fade in/out, full text).
 */
const STORYLINE_FADE_MS = 250;

export function getRandomChar(seed, index) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
    const pseudoRandom = (seed + index * 7919) % 2147483647;
    return chars[pseudoRandom % chars.length];
}

export function scrambleText(currentText, targetText, phase, progress, frame, seed) {
    let result = '';
    const targetLength = targetText.length;
    if (phase === 0) {
        for (let i = 0; i < currentText.length; i++) {
            const charProgress = progress;
            const randomValue = ((seed + i * 7919 + frame * 997) % 1000) / 1000;
            if (charProgress < 0.5) {
                const blend = charProgress * 2;
                result += (randomValue < blend) ? getRandomChar(seed, i + frame) : (currentText[i] || ' ');
            } else {
                result += getRandomChar(seed, i + frame);
            }
        }
        for (let i = currentText.length; i < targetLength; i++) result += getRandomChar(seed, i + frame);
    } else {
        for (let i = 0; i < targetLength; i++) {
            const charProgress = (i / targetLength) + (progress * 0.8);
            const randomValue = ((seed + i * 7919 + frame * 997) % 1000) / 1000;
            if (charProgress < 0.2) result += getRandomChar(seed, i + frame);
            else if (charProgress < 0.6) {
                const revealProgress = (charProgress - 0.2) / 0.4;
                result += (randomValue < revealProgress) ? (targetText[i] || ' ') : getRandomChar(seed, i + frame);
            } else result += targetText[i] || ' ';
        }
    }
    return result;
}

/**
 * Creates a storyline controller: fade out/in on change, full text shown. run(el, text), stop(), setupHoverReveal (no-op).
 */
export function createStorylineController() {
    let fadeTimeoutId = null;

    function stop() {
        if (fadeTimeoutId) clearTimeout(fadeTimeoutId);
        fadeTimeoutId = null;
    }

    function buildContent(text) {
        const nn = text.indexOf('\n\n');
        const titleText = nn === -1 ? text : text.slice(0, nn);
        const bodyText = nn === -1 ? '' : text.slice(nn + 2);
        const wrap = document.createElement('div');
        wrap.className = 'storyline-content';
        const titleSpan = document.createElement('span');
        titleSpan.className = 'storyline-title';
        titleSpan.textContent = titleText;
        wrap.appendChild(titleSpan);
        if (bodyText) {
            const sep = document.createElement('div');
            sep.className = 'storyline-separator';
            sep.setAttribute('aria-hidden', 'true');
            sep.textContent = '----------'.repeat(50);
            wrap.appendChild(sep);
            const bodySpan = document.createElement('span');
            bodySpan.className = 'storyline-body';
            bodySpan.textContent = bodyText;
            wrap.appendChild(bodySpan);
        }
        return wrap;
    }

    function run(el, text) {
        stop();
        if (!el) return;
        el.classList.remove('reveal');
        const durationMs = STORYLINE_FADE_MS;
        const contentWrap = el.querySelector('.storyline-content');
        const hasExisting = contentWrap && (contentWrap.querySelector('.storyline-title')?.textContent ?? '').length > 0;

        function applyNew() {
            el.innerHTML = '';
            if (!text || !String(text).trim()) return;
            const next = buildContent(String(text).trim());
            next.style.transition = `opacity ${durationMs}ms ease`;
            next.style.opacity = '0';
            el.appendChild(next);
            requestAnimationFrame(() => {
                next.style.opacity = '1';
            });
        }

        if (hasExisting && contentWrap) {
            contentWrap.style.transition = `opacity ${durationMs}ms ease`;
            contentWrap.style.opacity = '0';
            const onEnd = () => {
                contentWrap.removeEventListener('transitionend', onEnd);
                applyNew();
            };
            contentWrap.addEventListener('transitionend', onEnd);
            fadeTimeoutId = setTimeout(() => {
                if (contentWrap.parentNode) {
                    contentWrap.removeEventListener('transitionend', onEnd);
                    applyNew();
                }
                fadeTimeoutId = null;
            }, durationMs + 50);
        } else {
            el.innerHTML = '';
            if (text && String(text).trim()) {
                const next = buildContent(String(text).trim());
                next.style.transition = `opacity ${durationMs}ms ease`;
                next.style.opacity = '1';
                el.appendChild(next);
            }
        }
    }

    function setupHoverReveal() {
        /* No-op: fade controller shows full text, no hover reveal. */
    }

    return { run, stop, getState: () => null, setupHoverReveal };
}
