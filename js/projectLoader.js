/**
 * Load project data by id. Id comes from URL ?id=.
 */
import { getProject } from './storage.js';

/**
 * Get project id from current page URL query (?id=).
 * @returns {string|null} Trimmed id or null if missing/empty.
 */
export function getProjectIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    const id = (params.get('id') || '').trim();
    return id || null;
}

/**
 * Load project data by id (API then IndexedDB/localStorage fallback via storage.getProject).
 * @param {string} id - Project id.
 * @returns {Promise<object|null>} Resolves with { id, name, items, storyline } or null.
 */
export function loadProjectData(id) {
    return getProject(id);
}
