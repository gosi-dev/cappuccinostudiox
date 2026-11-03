/**
 * Shared constants, helpers, and global init.
 */
import './pageTransition.js';
import './basePath.js';

export const IDB_NAME = 'PortfolioCMS';
export const IDB_STORE = 'projects';
export const CMS_PROJECT_PREFIX = 'cms_project_';
export const CMS_LIST_KEY = 'cms_project_list';

/**
 * Pretty URLs and legacy paths -> real file name. Netlify serves /kitchen,
 * /work, /offers and /contact as 200 rewrites (the URL bar keeps the short
 * path), and with "Pretty URLs" on it also strips ".html" from every page,
 * so page detection has to be path-agnostic or the menu never initialises.
 */
const PAGE_ALIASES = {
    '': 'index.html',
    'cappuccinostudiox': 'index.html',
    'index': 'index.html',
    'studio': 'index.html',
    'kitchen': 'kitchen.html',
    'work': 'project-files.html',
    'project-files': 'project-files.html',
    'offers': 'offers.html',
    'contact': 'booking.html',
    'booking': 'booking.html',
    'project': 'project.html',
    'project-story': 'project-story.html',
    'admin': 'admin.html',
    '3d-cabinet': '3d-cabinet.html'
};

/**
 * Escape a value for HTML text and attribute contexts.
 *
 * Quotes are escaped too, so the result can be dropped inside a quoted
 * attribute (value="…") without breaking out. The old div.textContent trick
 * left quotes untouched, which made every `data-x="${escapeHtml(v)}"` a
 * potential attribute-injection sink.
 * @param {*} value - Value to escape (null/undefined become '').
 * @returns {string} Escaped string.
 */
export function escapeHtml(value) {
    if (value == null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function getPageName() {
    const path = window.location.pathname.replace(/\/+$/, '');
    const last = path.split('/').pop() || '';
    if (last.includes('.')) return last;                     // kitchen.html, project.html, ...
    return PAGE_ALIASES[last] || (last ? last + '.html' : 'index.html');
}

/**
 * Global init: detect page type, init menus, init animations (carousel), load project if project page.
 * Call from each page script after page-specific setup.
 * @param {object} [options]
 * @param {object} [options.projectPage] - Required for project.html: { projectId, state, runAfterLoad }
 * @param {function} [options.onReady] - Called when menu/carousel init is done (for first-visit loading on landing/kitchen/admin).
 */
export function init(options = {}) {
    const pageName = getPageName();

    if (pageName === 'project.html') {
        const projectPage = options.projectPage;
        if (!projectPage || !projectPage.projectId || !projectPage.state || typeof projectPage.runAfterLoad !== 'function') {
            return;
        }
        const { projectId, state, runAfterLoad } = projectPage;
        import('./storage.js')
            .then(({ getProject }) => getProject(projectId))
            .then(data => {
                if (data) {
                    return import('./projectRenderer.js').then(({ applyCmsData }) => {
                        applyCmsData(data, state, projectId);
                    });
                }
            })
            .finally(runAfterLoad);
        return;
    }

    // Menu / carousel are wired from what is actually in the DOM, not from the
    // page name, so a rewrite or a renamed file can never leave them dead.
    const hasMenu = !!document.getElementById('menuContainer');
    const hasCarousel = !!document.getElementById('carouselTrack');
    if (!hasMenu && !hasCarousel) {
        if (typeof options.onReady === 'function') options.onReady();
        return;
    }

    let ready = false;
    const notifyReady = () => {
        if (ready) return;
        ready = true;
        if (typeof options.onReady === 'function') options.onReady();
    };

    Promise.all([import('./loadingScreen.js'), import('./ui.js')])
        .then(([_, ui]) => {
            if (hasMenu) ui.setupMenuAnimated('menuContainer', 'menuButton');
            if (hasCarousel) {
                ui.initCarousel('carouselTrack', {
                    carouselSets: ui.carouselSets,
                    pageCarouselSets: ui.pageCarouselSets
                });
            }
            notifyReady();
        })
        .catch(err => {
            // Never leave the loading screen stuck because a module failed.
            console.warn('[init] menu/carousel failed:', err);
            notifyReady();
        });
}
