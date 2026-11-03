/**
 * Load/save project data. Primary: GET/POST /api/projects. Fallback: IndexedDB + localStorage.
 */
import { IDB_NAME, IDB_STORE, CMS_PROJECT_PREFIX, CMS_LIST_KEY } from './core.js';
import { apiUrl, BASE_PATH } from './basePath.js';

/**
 * Prefix local asset paths (e.g. /assets/projects/...) with the base path
 * so they resolve correctly when hosted under a subpath like /cappuccinostudiox.
 * External URLs (http/https/data:) and already-prefixed paths are left untouched.
 */
function prefixPath(p) {
    if (!p || !BASE_PATH) return p;
    if (typeof p !== 'string') return p;
    if (p.startsWith('http') || p.startsWith('data:') || p.startsWith('blob:')) return p;
    if (p.startsWith(BASE_PATH + '/')) return p;          // already prefixed
    if (p.startsWith('/')) return BASE_PATH + p;
    return p;
}

function prefixProjectPaths(data) {
    if (!data || !BASE_PATH) return data;
    if (data.thumbnail) data.thumbnail = prefixPath(data.thumbnail);
    if (data.defaultBackgroundUrl) data.defaultBackgroundUrl = prefixPath(data.defaultBackgroundUrl);
    if (data.default_background_url) data.default_background_url = prefixPath(data.default_background_url);
    if (Array.isArray(data.items)) {
        data.items.forEach(item => {
            if (item.src) item.src = prefixPath(item.src);
            if (item.thumbnail) item.thumbnail = prefixPath(item.thumbnail);
        });
    }
    if (Array.isArray(data.assets)) {
        data.assets.forEach(a => { if (a.src) a.src = prefixPath(a.src); });
    }
    if (data.caseStudy && typeof data.caseStudy === 'object') {
        ['heroImage', 'poster', 'cover'].forEach(key => {
            if (data.caseStudy[key]) data.caseStudy[key] = prefixPath(data.caseStudy[key]);
        });
    }
    return data;
}

function fetchBundledProjects() {
    return fetch(apiUrl('/src/data/projects.json'))
        .then(res => res.ok ? res.json() : [])
        .then(data => Array.isArray(data) ? data : [])
        .catch(() => []);
}

function normalizeProjectData(data, fallbackId) {
    const idStr = String(fallbackId ?? data?.id ?? '');
    return prefixProjectPaths({
        id: data?.id != null ? data.id : idStr,
        name: data?.name ?? `Project ${idStr}`,
        items: Array.isArray(data?.items) ? data.items : [],
        storyline: data?.storyline ?? '',
        storylineTitle: data?.storylineTitle ?? data?.storyline_title ?? '',
        thumbnail: data?.thumbnail ?? null,
        assets: Array.isArray(data?.assets) ? data.assets : [],
        defaultBackgroundUrl: data?.defaultBackgroundUrl ?? data?.default_background_url ?? null,
        layout: data?.layout ?? 'deck',
        caseStudy: data?.caseStudy ?? data?.case_study ?? null
    });
}

function getBundledProject(idStr) {
    return fetchBundledProjects().then(list => {
        const project = list.find(p => String(p.id) === String(idStr));
        return project ? normalizeProjectData(project, idStr) : null;
    });
}

export function openDB() {
    return new Promise((resolve, reject) => {
        const r = indexedDB.open(IDB_NAME, 1);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => resolve(r.result);
        r.onupgradeneeded = (e) => {
            if (!e.target.result.objectStoreNames.contains(IDB_STORE)) {
                e.target.result.createObjectStore(IDB_STORE, { keyPath: 'id' });
            }
        };
    });
}

function getProjectFromIDB(id) {
    return openDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(id);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(req.result || null);
    }));
}

function setProjectInIDB(id, data) {
    return openDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        store.put({ id: id, name: data.name, items: data.items || [], storyline: data.storyline || '', storylineTitle: data.storylineTitle || '', thumbnail: data.thumbnail || null, assets: data.assets || [], defaultBackgroundUrl: data.defaultBackgroundUrl || null, layout: data.layout || 'deck', caseStudy: data.caseStudy || null });
        tx.onerror = () => reject(tx.error);
        tx.oncomplete = () => resolve();
    }));
}

/**
 * Load a project by id. Tries GET /api/projects/:id, then IndexedDB,
 * then localStorage, and finally the bundled projects.json snapshot.
 * @param {string} id - Project id.
 * @returns {Promise<object|null>} Resolves with { id, name, items, storyline } or null.
 */
export function getProject(id) {
    const idStr = String(id);
    return fetch(apiUrl(`/api/local/projects/${encodeURIComponent(idStr)}`))
        .then(res => {
            if (res.ok) return res.json();
            throw new Error(res.statusText || 'get failed');
        })
        .then(data => normalizeProjectData(data, idStr))
        .catch(() => getProjectFromIDB(idStr)
            .then(record => record ? prefixProjectPaths({
                id: record.id,
                name: record.name,
                items: record.items || [],
                storyline: record.storyline || '',
                storylineTitle: record.storylineTitle || '',
                thumbnail: record.thumbnail || null,
                assets: record.assets || [],
                defaultBackgroundUrl: record.defaultBackgroundUrl || null,
                layout: record.layout || 'deck',
                caseStudy: record.caseStudy || null
            }) : null)
            .catch(() => null))
        .then(data => {
            if (data) return data;
            try {
                const raw = localStorage.getItem(CMS_PROJECT_PREFIX + idStr);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    return prefixProjectPaths({ id: idStr, name: parsed.name, items: parsed.items || [], storyline: parsed.storyline || '', storylineTitle: parsed.storylineTitle || '', thumbnail: parsed.thumbnail || null, assets: Array.isArray(parsed.assets) ? parsed.assets : [], defaultBackgroundUrl: parsed.defaultBackgroundUrl || null, layout: parsed.layout || 'deck', caseStudy: parsed.caseStudy || null });
                }
            } catch (e) {}
            return getBundledProject(idStr).catch(() => null);
        });
}

/**
 * Save a project. Tries POST /api/projects, then fallback: IndexedDB + localStorage.
 * @param {object} project - { id, name, items, storyline }.
 * @returns {Promise<void>}
 */
export function saveProject(project) {
    const id = project.id != null ? String(project.id) : '';
    const payload = { id, name: project.name ?? `Project ${id}`, items: project.items || [], storyline: project.storyline ?? '', storylineTitle: project.storylineTitle ?? '', thumbnail: project.thumbnail ?? null, assets: project.assets || [], defaultBackgroundUrl: project.defaultBackgroundUrl ?? null, layout: project.layout ?? 'deck', caseStudy: project.caseStudy ?? null };
    return fetch(apiUrl('/api/local/projects'), {  
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(async (res) => {
            if (res.ok) {
                // Keep IndexedDB and localStorage in sync with the server after successful save
                return setProjectInIDB(id, payload).then(() => {
                    try { localStorage.setItem(CMS_PROJECT_PREFIX + id, JSON.stringify(payload)); } catch (e) {}
                });
            }
            const msg = res.status === 413
                ? 'Project too large to sync (over 4.5 MB). Save works on this device only.'
                : (await res.text()) || res.statusText || 'Save failed';
            throw new Error(msg);
        })
        .catch((err) => {
            return setProjectInIDB(id, payload).then(() => {
                try { localStorage.setItem(CMS_PROJECT_PREFIX + id, JSON.stringify(payload)); } catch (e) {}
            }).then(() => { throw err; });
        });
}

export function deleteProjectFromIDB(id) {
    return openDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(String(id));
        tx.onerror = () => reject(tx.error);
        tx.oncomplete = () => resolve();
    }));
}

/** Sync read from localStorage only (for UI that needs current name/size without async). */
export function getProjectDataSync(projectId) {
    try {
        const raw = localStorage.getItem(CMS_PROJECT_PREFIX + projectId);
        const def = { name: `Project ${projectId}`, items: [], storyline: '', storylineTitle: '', thumbnail: null, defaultBackgroundUrl: null, assets: [], layout: 'deck', caseStudy: null };
        return prefixProjectPaths(raw ? Object.assign(def, JSON.parse(raw)) : def);
    } catch (e) {
        return { name: `Project ${projectId}`, items: [], storyline: '', storylineTitle: '', thumbnail: null, defaultBackgroundUrl: null, assets: [], layout: 'deck', caseStudy: null };
    }
}

export function getProjectList() {
    try {
        const raw = localStorage.getItem(CMS_LIST_KEY);
        if (!raw) return [];
        const list = JSON.parse(raw);
        if (!Array.isArray(list)) return [];
        return list.filter(Boolean).map(p => {
            if (p && p.thumbnail) p.thumbnail = prefixPath(p.thumbnail);
            if (p && p.deckThumbnail) p.deckThumbnail = prefixPath(p.deckThumbnail);
            return p;
        });
    } catch (e) {
        return [];
    }
}

/**
 * Fetch project list from API (id, name, thumbnail). Use on load so project cards and CMS list show on all devices.
 * @returns {Promise<Array<{id, name, thumbnail}>>}
 */
export function fetchProjectList() {
    return fetch(apiUrl('/api/local/projects'))
        .then(res => {
            if (res.ok) return res.json();
            return fetchBundledProjects().then(list => list.map(p => ({
                id: p.id,
                name: p.name,
                thumbnail: p.thumbnail || null,
                deckThumbnail: p.deckThumbnail || p.deck_thumbnail || null,
                discipline: (p.caseStudy && p.caseStudy.discipline) || p.discipline || null,
                layout: p.layout || 'deck'
            })));
        })
        .then(list => Array.isArray(list) ? list.map(p => {
            if (p.thumbnail) p.thumbnail = prefixPath(p.thumbnail);
            if (p.deckThumbnail) p.deckThumbnail = prefixPath(p.deckThumbnail);
            return p;
        }) : list)
        .catch(() => []);
}

export function saveProjectList(list) {
    localStorage.setItem(CMS_LIST_KEY, JSON.stringify(list));
}
