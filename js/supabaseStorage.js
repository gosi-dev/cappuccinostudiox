/**
 * Local file upload module.
 * Replaces the former Supabase Storage module — all uploads go to the local server
 * via POST /api/upload, which saves files to public/assets/projects/{projectId}/.
 * ZERO external dependencies.
 */

// Keep in sync with the server limits: server.mjs multer fileSize and the
// api.js body cap. The old 300 MB figure let the browser accept files the
// server would reject, which surfaced as a confusing 413.
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB per file
const FILE_TOO_LARGE_MSG = 'File too large (max 25 MB). Use a smaller file or compress it before uploading.';

function getBasePath() {
    return (window.__BASE_PATH || '');
}

/**
 * Upload a File to the local server. Returns the public URL or null on failure.
 */
export async function uploadFile(projectId, file, progress) {
    const size = file && file.size || 0;
    if (size > MAX_UPLOAD_BYTES) throw new Error(FILE_TOO_LARGE_MSG);
    if (progress && progress.onStart) progress.onStart(size);
    try {
        const form = new FormData();
        form.append('projectId', String(projectId));
        form.append('file', file);
        const res = await fetch(getBasePath() + '/api/upload', { method: 'POST', body: form });
        if (progress && progress.onDone) progress.onDone(size);
        if (!res.ok) { console.warn('Upload failed:', res.statusText); return null; }
        const data = await res.json();
        return data.url || null;
    } catch (e) {
        if (progress && progress.onDone) progress.onDone(size);
        console.warn('Upload error:', e);
        return null;
    }
}

/**
 * Upload a Blob to the local server. Returns the public URL or null.
 */
export async function uploadBlob(projectId, blob, filename, progress) {
    const file = new File([blob], filename, { type: blob.type });
    return uploadFile(projectId, file, progress);
}

/**
 * Upload a data URL to the local server. Returns the public URL or null.
 */
export async function uploadDataUrl(projectId, dataUrl, filename, progress) {
    if (!dataUrl || !dataUrl.startsWith('data:')) return null;
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return uploadBlob(projectId, blob, filename, progress);
}

/**
 * Local storage is always available.
 */
export async function isStorageAvailable() {
    return true;
}
