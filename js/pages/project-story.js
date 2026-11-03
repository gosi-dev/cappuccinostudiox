/**
 * Long-form project case study.
 *
 * The page paints its cover and copy immediately, then hydrates from the
 * bundled project snapshot and finally from persistent storage. Videos are
 * never fetched until the visitor explicitly opens one.
 */
import { getProject, fetchProjectList } from '../storage.js';
import { apiUrl, BASE_PATH } from '../basePath.js';
import { projectUrlFor } from '../projectRoutes.js';

const params = new URLSearchParams(window.location.search);
const projectId = params.get('id') || '8';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// How close to the end of the story the floating "back to files" button appears.
const EXIT_REVEAL_DISTANCE = 260;

const ref = {
    header: document.getElementById('storyHeader'),
    progressBar: document.getElementById('scrollProgressBar'),
    headerTitle: document.getElementById('headerTitle'),
    headerChapter: document.getElementById('headerChapter'),
    headerIndexCount: document.getElementById('headerIndexCount'),
    heroImage: document.getElementById('heroImage'),
    heroKicker: document.getElementById('heroKicker'),
    heroTitle: document.getElementById('heroTitle'),
    heroTagline: document.getElementById('heroTagline'),
    heroHeadline: document.getElementById('heroHeadline'),
    heroPlay: document.getElementById('heroPlay'),
    heroMeta: document.getElementById('heroMeta'),
    contextTitle: document.getElementById('contextTitle'),
    contextCopy: document.getElementById('contextCopy'),
    factSheet: document.getElementById('factSheet'),
    chapters: document.getElementById('chapters'),
    chapterRail: document.getElementById('chapterRail'),
    chapterHud: document.getElementById('chapterHud'),
    hudNext: document.getElementById('hudNext'),
    hudNextTitle: document.getElementById('hudNextTitle'),
    nextProject: document.getElementById('nextProject'),
    nextProjectTitle: document.getElementById('nextProjectTitle'),
    nextProjectMedia: document.getElementById('nextProjectMedia'),
    indexDialog: document.getElementById('indexDialog'),
    indexList: document.getElementById('indexList'),
    indexFooter: document.getElementById('indexFooter'),
    mediaDialog: document.getElementById('mediaDialog'),
    mediaTitle: document.getElementById('mediaTitle'),
    mediaMeta: document.getElementById('mediaMeta'),
    mediaStage: document.getElementById('mediaStage'),
    mediaCaptionTitle: document.getElementById('mediaCaptionTitle'),
    mediaCaptionCopy: document.getElementById('mediaCaptionCopy'),
    mediaCounter: document.getElementById('mediaCounter'),
    mediaPrev: document.getElementById('mediaPrev'),
    mediaNext: document.getElementById('mediaNext'),
    mediaClose: document.getElementById('mediaClose'),
    storyExit: document.getElementById('storyExit')
};

const state = {
    project: null,
    chapters: [],
    media: [],
    projectList: [],
    activeChapter: 0,
    mediaIndex: 0,
    signature: '',
    observer: null,
    revealObserver: null,
    rendered: false
};

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function assetUrl(path) {
    if (!path || typeof path !== 'string') return '';
    if (/^(https?:|data:|blob:)/i.test(path)) return path;
    if (BASE_PATH && path.startsWith(BASE_PATH + '/')) return path;
    if (BASE_PATH && path.startsWith('/')) return BASE_PATH + path;
    return path;
}

/**
 * Allowlist a URL before it lands in href/src/iframe src.
 * escapeHtml already stops attribute breakout, but a stored `javascript:` URL
 * would still run when a visitor clicked the link. Only http(s) and, when
 * explicitly allowed, blob:/same-origin-relative paths get through.
 * @param {string} value - Candidate URL.
 * @param {{ allowData?: boolean, allowBlob?: boolean }} [options]
 * @returns {string} A safe URL, or '' when the scheme is not allowed.
 */
function safeUrl(value, options = {}) {
    const raw = String(value == null ? '' : value).trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (options.allowBlob && /^blob:/i.test(raw)) return raw;
    if (options.allowData && /^data:(image\/(png|jpe?g|gif|webp|avif)|application\/pdf)[;,]?/i.test(raw)) return raw;
    // Relative paths are same-origin by definition; reject anything with a scheme.
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return '';
    return raw;
}

function paragraphs(text) {
    return String(text || '')
        .replace(/\r\n/g, '\n')
        .split(/\n\s*\n/)
        .map(part => part.trim())
        .filter(Boolean);
}

function copyHtml(text) {
    return paragraphs(text).map(part => `<p>${escapeHtml(part)}</p>`).join('');
}

function normalizeProject(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const rawCaseSource = raw.caseStudy || raw.case_study || {};
    const rawCase = rawCaseSource && typeof rawCaseSource === 'object' ? rawCaseSource : {};
    const caseStudy = {
        ...rawCase,
        heroImage: assetUrl(rawCase.heroImage || rawCase.poster || raw.thumbnail || ''),
        chapterNotes: (rawCase.chapterNotes && typeof rawCase.chapterNotes === 'object')
            ? rawCase.chapterNotes
            : (rawCase.chapter_notes && typeof rawCase.chapter_notes === 'object' ? rawCase.chapter_notes : {})
    };
    const items = (Array.isArray(raw.items) ? raw.items : [])
        .map(item => ({
            ...item,
            type: String(item.type || 'image').toLowerCase(),
            src: assetUrl(item.src || ''),
            thumbnail: assetUrl(item.thumbnail || ''),
            name: item.name || 'Untitled',
            storyline: item.storyline || ''
        }))
        .filter(item => item.src);
    return {
        id: raw.id != null ? String(raw.id) : projectId,
        name: raw.name || `Project ${projectId}`,
        layout: raw.layout || 'deck',
        storyline: raw.storyline || '',
        storylineTitle: raw.storylineTitle ?? raw.storyline_title ?? '',
        thumbnail: assetUrl(raw.thumbnail || ''),
        caseStudy,
        items
    };
}

function preferenceTitle(value) {
    const clean = String(value || '')
        .replace(/\s*\/\s*\d+\s*$/g, '')
        .replace(/6969/g, '')
        .trim();
    // Studio acronyms read wrong in title case ("Etj Series"), so put them back.
    const acronyms = new Set(['etj', 'hoba', 'mvp', 'ai', 'ugc', 'cgc']);
    return clean
        .toLowerCase()
        .replace(/(^|\s)\S/g, char => char.toUpperCase())
        .split(' ')
        .map(word => acronyms.has(word.toLowerCase()) ? word.toUpperCase() : word)
        .join(' ');
}

function groupItems(items) {
    const groups = [];
    const byTitle = new Map();
    items.forEach(item => {
        const title = preferenceTitle(item.name);
        const key = title.toLowerCase();
        let group = byTitle.get(key);
        if (!group) {
            group = { title, key, items: [], stories: [] };
            byTitle.set(key, group);
            groups.push(group);
        }
        group.items.push(item);
        const story = String(item.storyline || '').trim();
        if (story && !group.stories.includes(story)) group.stories.push(story);
    });

    const notes = (state.project && state.project.caseStudy && state.project.caseStudy.chapterNotes) || {};
    const layouts = (state.project && state.project.caseStudy && state.project.caseStudy.chapterLayouts) || {};
    return groups.map((group, index) => {
        const allImages = group.items.every(item => item.type === 'image' || item.type === 'pdf');
        const title = group.title.toLowerCase();
        // Chapters like "The Approach" or "Studio Role" are sometimes image-only,
        // but they are still written chapters - not loose objects.
        const isWrittenChapter = /approach|studio role|world building|the plan/.test(title);
        const kind = title.includes('why it matters') ? 'manifesto'
            : title.includes('conclusion') ? 'closing'
                : allImages && !isWrittenChapter ? 'artifact' : 'film';
        const note = notes[group.title] || notes[group.title.toUpperCase()] || notes[group.title.toLowerCase()] || '';
        const layout = layouts[group.title] || layouts[group.title.toUpperCase()] || layouts[group.title.toLowerCase()] || '';
        return {
            ...group,
            number: String(index + 1).padStart(2, '0'),
            index: index + 1,
            kind,
            layout,
            note,
            copy: group.stories.join('\n\n')
        };
    });
}

function dataSignature(project) {
    return JSON.stringify({
        id: project.id,
        name: project.name,
        storyline: project.storyline,
        storylineTitle: project.storylineTitle,
        thumbnail: project.thumbnail,
        caseStudy: project.caseStudy,
        items: project.items
    });
}

function heroTitle(project) {
    return (project.caseStudy.title || project.name || 'Project')
        .replace(/\s*\/\s*story\s*$/i, '')
        .trim();
}

function firstVideo() {
    return state.media.findIndex(item => item.type === 'video');
}

function renderHero(project) {
    const caseStudy = project.caseStudy || {};
    const title = heroTitle(project);
    const kicker = caseStudy.kicker || 'Case Study';
    const tagline = caseStudy.tagline || project.storylineTitle || '';
    const heroImage = caseStudy.heroImage || project.thumbnail || '';

    document.title = `${title} — Cappuccino Studiox`;
    ref.headerTitle.textContent = title;
    ref.heroKicker.textContent = kicker;
    ref.heroTitle.textContent = title;
    ref.heroTagline.textContent = tagline;

    const headline = (caseStudy.headline || '').trim();
    if (ref.heroHeadline) {
        ref.heroHeadline.textContent = headline;
        ref.heroHeadline.hidden = !headline;
    }
    if (heroImage) ref.heroImage.src = heroImage;
    ref.heroImage.alt = `${title} key art`;
    ref.heroImage.style.setProperty('--hero-position', caseStudy.heroPosition || '50% 44%');

    const facts = [
        ['Client', caseStudy.client],
        ['Year', caseStudy.year],
        ['Discipline', caseStudy.discipline],
        ['Studio scope', Array.isArray(caseStudy.scope) ? caseStudy.scope.slice(0, 3).join(', ') : caseStudy.scope]
    ].filter(([, value]) => value);

    if (facts.length) {
        ref.heroMeta.innerHTML = facts.map(([label, value]) => `
            <div>
                <dt class="meta-label">${escapeHtml(label)}</dt>
                <dd class="meta-value">${escapeHtml(value)}</dd>
            </div>
        `).join('');
    } else {
        ref.heroMeta.innerHTML = `
            <div>
                <dt class="meta-label">Project</dt>
                <dd class="meta-value">${escapeHtml(title)}</dd>
            </div>
            <div>
                <dt class="meta-label">Studio</dt>
                <dd class="meta-value">Cappuccino Studiox</dd>
            </div>
        `;
    }
}

function renderContext(project) {
    const caseStudy = project.caseStudy || {};
    const title = project.storylineTitle || caseStudy.contextTitle || 'The brief';
    const body = project.storyline || caseStudy.context || '';
    ref.contextTitle.textContent = title;
    if (body) ref.contextCopy.innerHTML = copyHtml(body);

    const facts = [
        ['Client', caseStudy.client],
        ['Year', caseStudy.year],
        ['Discipline', caseStudy.discipline],
        ['Scope', Array.isArray(caseStudy.scope) ? caseStudy.scope : null],
        ['Format', caseStudy.format],
        ['Status', caseStudy.status]
    ].filter(([, value]) => Array.isArray(value) ? value.length : value);

    if (!facts.length) {
        ref.factSheet.hidden = true;
        return;
    }

    ref.factSheet.hidden = false;
    ref.factSheet.innerHTML = facts.map(([label, value]) => {
        const content = Array.isArray(value)
            ? `<ul class="scope-list">${value.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
            : escapeHtml(value);
        return `<div class="fact"><dt>${escapeHtml(label)}</dt><dd>${content}</dd></div>`;
    }).join('');
}

function renderNextProject(project) {
    const nextId = project.caseStudy.nextProjectId;
    if (!nextId) {
        ref.nextProject.hidden = true;
        return;
    }
    const next = state.projectList.find(item => String(item.id) === String(nextId));
    if (!next) {
        ref.nextProject.hidden = true;
        return;
    }
    ref.nextProject.hidden = false;
    ref.nextProjectTitle.textContent = next.name || 'Next project';
    ref.nextProject.href = projectUrlFor(next.id, state.projectList);
    ref.nextProjectMedia.innerHTML = next.thumbnail
        ? `<img src="${escapeHtml(assetUrl(next.thumbnail))}" alt="${escapeHtml(next.name || 'Next project')}" loading="lazy" decoding="async">`
        : '';
}

function updateChapterChrome() {
    const total = state.chapters.length;
    const chapter = state.chapters[state.activeChapter - 1];
    const upcoming = state.chapters[state.activeChapter];
    if (chapter) {
        ref.headerChapter.textContent = `${chapter.number} / ${String(total).padStart(2, '0')}`;
    } else {
        ref.headerChapter.textContent = `00 / ${String(total).padStart(2, '0')}`;
    }
    if (upcoming) {
        ref.hudNextTitle.textContent = upcoming.title;
        ref.hudNext.hidden = false;
    } else if (ref.nextProject && !ref.nextProject.hidden) {
        ref.hudNextTitle.textContent = 'Next project';
        ref.hudNext.hidden = false;
    } else {
        ref.hudNext.hidden = true;
    }
    ref.headerIndexCount.textContent = String(total).padStart(2, '0');
    ref.chapterHud.classList.toggle('is-visible', state.activeChapter > 0);
}

function chapterKicker(group) {
    // A project can name its own chapters' kickers - the four-section stories read
    // wrong when "The Approach" is labelled "What we made".
    const custom = (state.project && state.project.caseStudy && state.project.caseStudy.chapterKickers) || {};
    const match = custom[group.title] || custom[group.title.toUpperCase()] || custom[group.title.toLowerCase()];
    if (match) return match;
    if (group.kind === 'manifesto') return 'Impact / Why it matters';
    if (group.kind === 'closing') return 'Closing / The takeaway';
    if (group.kind === 'artifact') return 'The pieces / Objects from the world';
    return 'What we made';
}

function mediaLabel(item) {
    if (item.type === 'video') return 'Film';
    if (item.type === 'pdf') return 'Document';
    return 'Still';
}

function mediaPoster(item, project) {
    if (item.thumbnail) return item.thumbnail;
    if (item.type === 'image') return item.src;
    return project.caseStudy.heroImage || project.thumbnail || '';
}

function mediaCard(item, mediaIndex, project) {
    const poster = mediaPoster(item, project);
    const name = item.cardTitle || item.name || 'Untitled';
    const label = mediaLabel(item);
    // Items can pin their card frame: 'slide' keeps a deck page at the deck's own 16:9.
    const orientation = item.aspect === 'slide' ? 'slide'
        : item.portrait ? 'portrait'
            : (item.type === 'image' || item.type === 'pdf') ? 'tall' : 'wide';
    const isPdf = item.type === 'pdf';
    const attrs = isPdf
        ? `href="${escapeHtml(safeUrl(item.src))}" target="_blank" rel="noopener"`
        : `type="button" data-media-index="${mediaIndex}"`;
    const tag = isPdf ? 'a' : 'button';
    const play = !isPdf && item.type === 'video'
        ? `<span class="media-play" aria-hidden="true"><svg viewBox="0 0 16 16"><use href="#icon-play"></use></svg></span>`
        : '';
    const visual = poster
        ? `<img src="${escapeHtml(safeUrl(poster, { allowData: true }))}" alt="${escapeHtml(name)}" loading="lazy" decoding="async"${item.focus ? ` style="object-position:${escapeHtml(item.focus)}"` : ''}>`
        : '';
    const action = isPdf ? 'Open' : item.type === 'video' ? 'Play' : 'View';
    return `
        <${tag} class="media-card media-card--${orientation}" ${attrs} aria-label="${escapeHtml(`${action} ${name}`)}">
            ${visual}
            <span class="media-badge">${escapeHtml(label)}</span>
            ${play}
            <span class="media-title">
                <span>${escapeHtml(name)}</span>
                <span>${escapeHtml(action)}</span>
            </span>
        </${tag}>
    `;
}

function mediaGridClass(items, kind) {
    if (items.length === 1) return 'media-grid--single';
    if (items.length === 2) {
        // A still next to a portrait film reads as one pair, not a hole between two cards.
        const still = items.some(item => item.type !== 'video' && !item.portrait);
        const portraitFilm = items.some(item => item.type === 'video' && item.portrait);
        return still && portraitFilm ? 'media-grid--duo media-grid--still-film' : 'media-grid--duo';
    }
    // Four pieces in one chapter: documents read as a single row of four,
    // artefacts get the bigger two-by-two wall instead of a strip of thumbnails.
    if (items.length === 4) return kind === 'artifact' ? 'media-grid--duo' : 'media-grid--quad';
    return 'media-grid--trio';
}

function renderChapters(project) {
    state.media = [];
    const chapterHtml = state.chapters.map((group, groupIndex) => {
        const entries = group.items.map(item => {
            const mediaIndex = state.media.length;
            state.media.push({ ...item, chapterTitle: group.title, chapterNumber: group.number });
            return { item, html: mediaCard(item, mediaIndex, project) };
        });
        // "aside" chapters set one card beside the copy and the rest below it;
        // "aside-pair" sets two films beside the copy as a matched pair.
        const asideTargets = group.layout === 'aside-pair' ? 2 : group.layout === 'aside' ? 1 : 0;
        let asideCards = [];
        let asideIsStill = false;
        if (asideTargets === 1 && entries.length > 0) {
            const at = entries.findIndex(entry => entry.item.portrait);
            const [taken] = entries.splice(at > -1 ? at : 0, 1);
            asideCards = [taken.html];
            asideIsStill = taken.item.type !== 'video';
        } else if (asideTargets > 1 && entries.length > 0) {
            const taken = entries.splice(0, Math.min(asideTargets, entries.length));
            asideCards = taken.map(entry => entry.html);
            asideIsStill = taken.every(entry => entry.item.type !== 'video');
        }
        const aside = asideCards.length > 0;
        const asideClass = [
            'chapter-aside',
            asideIsStill ? 'chapter-aside--still' : '',
            asideCards.length > 1 ? 'chapter-aside--pair' : ''
        ].filter(Boolean).join(' ');
        const cards = entries.map(entry => entry.html);
        const gridClass = mediaGridClass(entries.map(entry => entry.item), group.kind);
        const next = state.chapters[groupIndex + 1];
        const copy = [group.copy, group.note].filter(Boolean).join('\n\n');
        const nextHtml = next
            ? `<a class="chapter-next" href="#chapter-${next.index}">
                    <span>Next chapter</span>
                    <span>${escapeHtml(next.title)} &#8594;</span>
               </a>`
            : '';
        return `
            <section class="chapter chapter--${group.kind}${aside ? ' chapter--aside' : ''}" id="chapter-${group.index}" data-chapter="${group.index}" aria-labelledby="chapter-title-${group.index}">
                <div class="chapter-inner">
                    <div class="chapter-head${aside ? ' chapter-head--aside' : ''} reveal">
                        <span class="chapter-number">${group.number}</span>
                        <div class="chapter-heading">
                            <p class="chapter-kicker">${escapeHtml(chapterKicker(group))}</p>
                            <h2 id="chapter-title-${group.index}">${escapeHtml(group.title)}</h2>
                        </div>
                        <div class="chapter-copy">${copyHtml(copy)}</div>
                        ${aside ? `<div class="${asideClass} reveal reveal-delay-2">${asideCards.join('')}</div>` : ''}
                    </div>
                    ${cards.length ? `<div class="chapter-media ${gridClass} reveal reveal-delay-1">
                        ${cards.join('')}
                    </div>` : ''}
                    ${nextHtml}
                </div>
            </section>
        `;
    }).join('');

    ref.chapters.innerHTML = chapterHtml ||
        `<section class="chapter"><div class="chapter-inner"><div class="chapter-copy"><p>This project does not have any media yet.</p></div></div></section>`;
}

function renderRail() {
    const entries = [
        { index: 0, number: '00', title: 'Context', target: 'context' },
        ...state.chapters.map(group => ({
            index: group.index,
            number: group.number,
            title: group.title,
            target: `chapter-${group.index}`
        }))
    ];
    ref.chapterRail.innerHTML = entries.map(entry => `
        <button class="rail-link${entry.index === state.activeChapter ? ' is-active' : ''}" type="button" data-target="${entry.target}" aria-label="Go to ${escapeHtml(entry.title)}">
            <span class="rail-number">${entry.number}</span>
            <span class="rail-line" aria-hidden="true"></span>
            <span class="rail-label">${escapeHtml(entry.title)}</span>
        </button>
    `).join('');
}

function renderIndex() {
    const entries = [
        { index: 0, number: '00', title: 'Context', meta: 'The brief', target: 'context', kind: 'context' },
        ...state.chapters.map(group => ({
            index: group.index,
            number: group.number,
            title: group.title,
            meta: `${group.items.length} ${group.items.length === 1 ? 'asset' : 'assets'} / ${group.kind}`,
            target: `chapter-${group.index}`,
            kind: group.kind
        }))
    ];
    ref.indexList.innerHTML = entries.map(entry => `
        <li>
            <button class="index-link" type="button" data-target="${entry.target}">
                <span class="index-link-number">${entry.number}</span>
                <span class="index-link-title">${escapeHtml(entry.title)}</span>
                <span class="index-link-meta">${escapeHtml(entry.meta)}</span>
            </button>
        </li>
    `).join('');
    const count = state.chapters.length;
    ref.indexFooter.innerHTML = `${count} chapter${count === 1 ? '' : 's'}. One world.<br>Use arrow keys to move through films and images.`;
}

function scrollToTarget(target) {
    const element = document.getElementById(target);
    if (!element) return;
    const headerOffset = target === 'context' ? 0 : 64;
    const top = element.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
}

function setActiveChapter(index) {
    if (!Number.isFinite(index) || index < 0) return;
    state.activeChapter = index;
    updateChapterChrome();
    ref.chapterRail.querySelectorAll('.rail-link').forEach(link => {
        link.classList.toggle('is-active', link.dataset.target === (index === 0 ? 'context' : `chapter-${index}`));
    });
}

function refreshObservers() {
    if (state.observer) state.observer.disconnect();
    if (state.revealObserver) state.revealObserver.disconnect();

    const sections = [document.getElementById('context'), ...state.chapters.map(group => document.getElementById(`chapter-${group.index}`))]
        .filter(Boolean);

    if ('IntersectionObserver' in window) {
        state.observer = new IntersectionObserver(entries => {
            const visible = entries
                .filter(entry => entry.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
            if (!visible) return;
            setActiveChapter(Number(visible.target.dataset.chapter || 0));
        }, { rootMargin: '-38% 0px -50% 0px', threshold: [0, 0.01, 0.2, 0.5] });
        sections.forEach(section => state.observer.observe(section));
    }

    const revealItems = Array.from(document.querySelectorAll('.reveal'));
    if (reduceMotion) {
        revealItems.forEach(element => element.classList.add('is-revealed'));
        return;
    }

    if ('IntersectionObserver' in window) {
        state.revealObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-revealed');
                state.revealObserver.unobserve(entry.target);
            });
        }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
        revealItems.forEach(element => state.revealObserver.observe(element));
    } else {
        revealItems.forEach(element => element.classList.add('is-revealed'));
    }

    /* The copy must never remain hidden if an observer is throttled. */
    setTimeout(() => revealItems.forEach(element => element.classList.add('is-revealed')), 1800);
}

function renderProject(project) {
    if (!project || !project.items) return;
    const signature = dataSignature(project);
    if (signature === state.signature) return;
    state.project = project;
    state.signature = signature;
    state.chapters = groupItems(project.items);

    renderHero(project);
    renderContext(project);
    renderChapters(project);
    ref.heroPlay.hidden = firstVideo() < 0;
    renderRail();
    renderIndex();
    renderNextProject(project);
    state.rendered = true;

    setActiveChapter(state.activeChapter);
    refreshObservers();
}

/* ---------- Index dialog ---------- */
function openIndex() {
    if (!ref.indexDialog || typeof ref.indexDialog.showModal !== 'function') return;
    ref.indexList.querySelectorAll('.index-link').forEach(link => {
        const target = link.dataset.target;
        link.classList.toggle('is-current', target === (state.activeChapter === 0 ? 'context' : `chapter-${state.activeChapter}`));
    });
    ref.indexDialog.showModal();
    document.body.classList.add('story-dialog-open');
}

function closeIndex() {
    if (ref.indexDialog && ref.indexDialog.open) ref.indexDialog.close();
}

document.querySelectorAll('[data-index-open]').forEach(button => {
    button.addEventListener('click', openIndex);
});
document.querySelectorAll('[data-index-close]').forEach(button => {
    button.addEventListener('click', closeIndex);
});
ref.indexDialog.addEventListener('close', () => document.body.classList.remove('story-dialog-open'));
ref.indexDialog.addEventListener('click', event => {
    if (event.target === ref.indexDialog) closeIndex();
});
ref.indexList.addEventListener('click', event => {
    const link = event.target.closest('[data-target]');
    if (!link) return;
    const target = link.dataset.target;
    closeIndex();
    setTimeout(() => scrollToTarget(target), 70);
});

/* ---------- Chapter jump / scroll chrome ---------- */
ref.chapterRail.addEventListener('click', event => {
    const link = event.target.closest('[data-target]');
    if (!link) return;
    scrollToTarget(link.dataset.target);
});

ref.hudNext.addEventListener('click', () => {
    const next = state.chapters[state.activeChapter];
    if (next) {
        scrollToTarget(`chapter-${next.index}`);
    } else if (ref.nextProject && !ref.nextProject.hidden) {
        ref.nextProject.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
});

let scrollFrame = 0;
function updateScrollChrome() {
    scrollFrame = 0;
    const scrollTop = window.scrollY || window.pageYOffset;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    ref.progressBar.style.transform = `scaleX(${Math.min(1, Math.max(0, scrollTop / max))})`;
    ref.header.classList.toggle('is-scrolled', scrollTop > 52);
    // Offer the way out once the reader has reached the end of the study.
    if (ref.storyExit) {
        ref.storyExit.classList.toggle('is-visible', max - scrollTop <= EXIT_REVEAL_DISTANCE);
    }
}

function requestScrollUpdate() {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(updateScrollChrome);
}

window.addEventListener('scroll', requestScrollUpdate, { passive: true });
window.addEventListener('resize', requestScrollUpdate);

/* ---------- Media lightbox ---------- */
function mediaStatus(message) {
    ref.mediaStage.innerHTML = `<p class="media-stage-status">${escapeHtml(message)}</p>`;
}

function mediaError(item, message) {
    ref.mediaStage.innerHTML = `
        <div class="media-error">
            ${escapeHtml(message)}<br>
            <a href="${escapeHtml(safeUrl(item.src))}" target="_blank" rel="noopener">Open the original file</a>
        </div>
    `;
}

function stopStageMedia() {
    const video = ref.mediaStage.querySelector('video');
    if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
    }
    const iframe = ref.mediaStage.querySelector('iframe');
    if (iframe) iframe.src = 'about:blank';
}

function showMedia() {
    const item = state.media[state.mediaIndex];
    if (!item) return;
    stopStageMedia();
    ref.mediaStage.innerHTML = '';
    ref.mediaTitle.textContent = item.chapterTitle || item.name || 'Project media';
    ref.mediaMeta.textContent = `Chapter ${item.chapterNumber || '—'} / ${mediaLabel(item)}`;
    ref.mediaCaptionTitle.textContent = item.cardTitle || item.name || 'Untitled';
    ref.mediaCaptionCopy.textContent = item.storyline || '';
    ref.mediaCounter.textContent = `${state.mediaIndex + 1} / ${state.media.length}`;

    if (item.type === 'video') {
        mediaStatus('Loading film…');
        const video = document.createElement('video');
        video.controls = true;
        video.playsInline = true;
        video.muted = true;
        video.loop = true;
        video.preload = 'metadata';
        if (item.thumbnail) video.poster = safeUrl(item.thumbnail, { allowData: true });
        video.src = safeUrl(item.src, { allowBlob: true });
        video.addEventListener('loadedmetadata', () => {
            const start = Number.isFinite(Number(item.trimStart)) ? Number(item.trimStart) : 0;
            if (start > 0 && start < video.duration) video.currentTime = start;
        });
        video.addEventListener('canplay', () => {
            const status = ref.mediaStage.querySelector('.media-stage-status');
            if (status) status.remove();
            video.play().catch(() => {});
        }, { once: true });
        video.addEventListener('timeupdate', () => {
            const end = Number(item.trimEnd);
            const start = Number.isFinite(Number(item.trimStart)) ? Number(item.trimStart) : 0;
            if (Number.isFinite(end) && end > start && video.currentTime >= end) video.currentTime = start;
        });
        video.addEventListener('error', () => {
            mediaError(item, 'This film could not be played in the browser.');
        });
        ref.mediaStage.appendChild(video);
        return;
    }

    if (item.type === 'pdf') {
        const frame = document.createElement('iframe');
        frame.title = item.name || 'Project document';
        // Same-origin path or https only: a javascript:/data: src here would run
        // in the page's origin.
        const safeSrc = safeUrl(item.src, { allowBlob: true });
        if (!safeSrc) {
            mediaError(item, 'This document link is not allowed.');
            return;
        }
        frame.src = safeSrc;
        ref.mediaStage.appendChild(frame);
        return;
    }

    mediaStatus('Loading image…');
    const image = document.createElement('img');
    image.src = safeUrl(item.src, { allowData: true, allowBlob: true });
    image.alt = item.name || '';
    image.decoding = 'async';
    image.addEventListener('load', () => {
        const status = ref.mediaStage.querySelector('.media-stage-status');
        if (status) status.remove();
    });
    image.addEventListener('error', () => mediaError(item, 'This image could not be loaded.'));
    ref.mediaStage.appendChild(image);
}

function openMedia(index) {
    if (!state.media[index]) return;
    state.mediaIndex = index;
    showMedia();
    if (ref.mediaDialog && typeof ref.mediaDialog.showModal === 'function') {
        ref.mediaDialog.showModal();
        document.body.classList.add('story-dialog-open');
        ref.mediaClose.focus({ preventScroll: true });
    }
}

function closeMedia() {
    if (ref.mediaDialog && ref.mediaDialog.open) ref.mediaDialog.close();
}

function stepMedia(direction) {
    if (!state.media.length) return;
    state.mediaIndex = (state.mediaIndex + direction + state.media.length) % state.media.length;
    showMedia();
}

ref.mediaDialog.addEventListener('close', () => {
    stopStageMedia();
    ref.mediaStage.innerHTML = '';
    document.body.classList.remove('story-dialog-open');
});
ref.mediaDialog.addEventListener('click', event => {
    if (event.target === ref.mediaDialog) closeMedia();
});
ref.mediaClose.addEventListener('click', closeMedia);
ref.mediaPrev.addEventListener('click', () => stepMedia(-1));
ref.mediaNext.addEventListener('click', () => stepMedia(1));

ref.chapters.addEventListener('click', event => {
    const trigger = event.target.closest('[data-media-index]');
    if (!trigger) return;
    openMedia(Number(trigger.dataset.mediaIndex));
});

ref.heroPlay.addEventListener('click', () => {
    const index = firstVideo();
    if (index >= 0) openMedia(index);
});

document.addEventListener('keydown', event => {
    if (ref.mediaDialog.open) {
        /* Let native video controls keep arrow-key seek behaviour. */
        if (event.target instanceof HTMLVideoElement) return;
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            stepMedia(1);
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            stepMedia(-1);
        }
        return;
    }
    if (event.key === 'Escape' && ref.indexDialog.open) closeIndex();
});

/* ---------- Boot ---------- */
function applyProjectList(list) {
    if (!Array.isArray(list) || !list.length) return;
    state.projectList = list;
    if (state.project) renderNextProject(state.project);
}

function loadBundledProjects() {
    return fetch(apiUrl('/src/data/projects.json'), { cache: 'no-store' })
        .then(response => response.ok ? response.json() : [])
        .then(data => Array.isArray(data) ? data : [])
        .catch(() => []);
}

function showLoadError() {
    ref.headerChapter.textContent = '—';
    ref.chapters.innerHTML = `
        <section class="chapter">
            <div class="chapter-inner">
                <div class="chapter-head">
                    <span class="chapter-number">!</span>
                    <div>
                        <p class="chapter-kicker">Project unavailable</p>
                        <h2>We could not load this story.</h2>
                    </div>
                    <div class="chapter-copy">
                        <p>The project data did not arrive. Check your connection or return to the project files.</p>
                        <p><a href="project-files.html">Back to all projects</a></p>
                    </div>
                </div>
            </div>
        </section>
    `;
}

/* Paint from the bundled snapshot first — no video or API round-trip required. */
loadBundledProjects().then(list => {
    applyProjectList(list);
    const bundled = list.find(project => String(project.id) === String(projectId));
    if (bundled) renderProject(normalizeProject(bundled));
});

fetchProjectList().then(applyProjectList).catch(() => {});

getProject(projectId)
    .then(raw => {
        if (!raw) {
            if (state.rendered) return;
            /* The HTML shell ships with the default story baked in. When the id
               points at a project that no longer exists, send people to the
               files instead of showing someone else's case study. */
            const known = state.projectList.some(project => String(project.id) === String(projectId));
            if (state.projectList.length && !known) {
                window.location.replace('project-files.html');
                return;
            }
            showLoadError();
            return;
        }
        renderProject(normalizeProject(raw));
        updateScrollChrome();
    })
    .catch(() => {
        if (!state.rendered) showLoadError();
    });

window.setTimeout(() => {
    if (!state.rendered) showLoadError();
}, 8000);

updateScrollChrome();



