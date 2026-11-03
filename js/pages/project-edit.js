/**
 * Project edit page: load/save via getProject() and saveProject(), playlist UI.
 */
import { escapeHtml, init } from '../core.js';
import { getProjectIdFromURL } from '../projectLoader.js';
import { getProject, saveProject, getProjectDataSync, getProjectList, saveProjectList } from '../storage.js';
import { uploadFile, uploadDataUrl } from '../supabaseStorage.js';
import { showLoadingScreen, hideLoadingScreen } from '../loadingScreen.js';

const PROJECT_STORAGE_LIMIT_BYTES = 300 * 1024 * 1024;

const projectId = getProjectIdFromURL();
if (!projectId) {
    document.body.innerHTML = '<p>Missing project id.</p><a href="content-management.html" class="back-link">← Back</a>';
    throw new Error('missing id');
}

function getProjectSizeBytes(data) {
    return new Blob([JSON.stringify(data)]).size;
}

let items = [];
let assets = [];
let thumbnailDataUrl = null;
let defaultBackgroundUrl = null;
let projectLayout = 'deck';
let projectCaseStudy = null;

const uploadProgress = {
    total: 0,
    done: 0,
    totalBytes: 0,
    doneBytes: 0,
    hideTimeout: null,
    recordStart(bytes) {
        this.total += 1;
        this.totalBytes += bytes || 0;
        this.show();
    },
    recordDone(bytes) {
        this.done += 1;
        this.doneBytes += bytes || 0;
        this.updateText();
        if (this.done >= this.total) {
            if (this.hideTimeout) clearTimeout(this.hideTimeout);
            this.hideTimeout = setTimeout(() => {
                this.reset();
                this.hide();
            }, 1500);
        }
    },
    show() {
        const el = document.getElementById('uploadProgressOverlay');
        if (el) el.style.display = 'flex';
        this.updateText();
    },
    hide() {
        const el = document.getElementById('uploadProgressOverlay');
        if (el) el.style.display = 'none';
    },
    updateText() {
        const el = document.getElementById('uploadProgressText');
        if (!el) return;
        const totalMB = (this.totalBytes / (1024 * 1024)).toFixed(2);
        const doneMB = (this.doneBytes / (1024 * 1024)).toFixed(2);
        if (this.total === 0) {
            el.textContent = '0 of 0 items · 0 MB of 0 MB';
        } else if (this.done >= this.total) {
            el.textContent = 'All uploads complete · ' + doneMB + ' MB uploaded';
        } else {
            el.textContent = this.done + ' of ' + this.total + ' items · ' + doneMB + ' MB of ' + totalMB + ' MB';
        }
    },
    reset() {
        this.total = 0;
        this.done = 0;
        this.totalBytes = 0;
        this.doneBytes = 0;
    }
};

function uploadProgressCallbacks() {
    return {
        onStart: (bytes) => uploadProgress.recordStart(bytes),
        onDone: (bytes) => uploadProgress.recordDone(bytes)
    };
}

function getItemSrc(item) {
    if (item.src) return item.src;
    if (item.assetId && assets.length) {
        const a = assets.find(aa => aa.id === item.assetId);
        return a ? a.src : '';
    }
    return '';
}

/** For gallery/preview: PDF uses thumbnail image; image/video use src. */
function getItemPreviewSrc(item) {
    if (item.type === 'pdf' && item.thumbnail) return item.thumbnail;
    return getItemSrc(item);
}

function formatTrimTime(s) {
    if (s == null || !isFinite(s)) return '';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m + ':' + String(sec).padStart(2, '0');
}

function renderItem(item, index) {
    const isFirst = index === 0;
    const isLast = index === items.length - 1;
    const src = getItemSrc(item);
    const previewSrc = getItemPreviewSrc(item);
    let preview;
    if (item.type === 'video') {
        preview = '<video class="preview-video" src="' + escapeHtml(src) + '" muted preload="metadata"></video>';
    } else if (item.type === 'pdf') {
        preview = previewSrc
            ? '<img class="preview" src="' + escapeHtml(previewSrc) + '" alt="">'
            : '<div class="preview preview-pdf-placeholder" title="Set thumbnail">PDF</div>';
    } else {
        preview = '<img class="preview" src="' + escapeHtml(previewSrc) + '" alt="">';
    }
    const trimLabel = item.type === 'video' && item.trimStart != null && item.trimEnd != null
        ? '<div class="trim-label">Trim ' + formatTrimTime(item.trimStart) + ' – ' + formatTrimTime(item.trimEnd) + '</div>'
        : '';
    const pdfThumbBtn = item.type === 'pdf'
        ? '<button type="button" class="set-pdf-thumb-btn" data-index="' + index + '" title="Set thumbnail">' + (item.thumbnail ? 'Change thumbnail' : 'Set thumbnail') + '</button>'
        : '';
    return '<li data-index="' + index + '">' +
        '<span class="drag-handle" title="Drag to reorder">⋮⋮</span>' +
        preview +
        '<div class="body"><div class="item-name" data-index="' + index + '" contenteditable="true" title="Click to rename">' + escapeHtml(item.name) + '</div>' + trimLabel +
        (item.storyline != null && item.storyline !== '' ? '<div class="item-storyline-preview" title="Content storyline">' + escapeHtml(String(item.storyline).slice(0, 60)) + (item.storyline.length > 60 ? '…' : '') + '</div>' : '') +
        '<div class="row"><span class="switch-label">Background roster</span>' +
        '<div class="switch ' + (item.backgroundRoster ? 'on' : '') + '" data-index="' + index + '" role="button" tabindex="0"></div></div>' +
        '<div class="row"><span class="switch-label">Default background</span>' +
        '<div class="switch switch-default-bg ' + (item.defaultBackgroundRoster ? 'on' : '') + '" data-index="' + index + '" data-default-bg="1" role="button" tabindex="0" title="Shows on first load and when this content is not on the background roster"></div></div>' +
        (item.type === 'video' ? '<div class="row"><span class="switch-label">Sound</span><div class="switch switch-sound ' + (item.audioEnabled ? 'on' : '') + '" data-index="' + index + '" data-sound="1" role="button" tabindex="0" title="Play this video with sound when opened"></div></div>' : '') +
        '<div class="row storyline-row"><label class="switch-label">Storyline title (gallery caption)</label></div>' +
        '<input type="text" class="item-storyline-title" data-index="' + index + '" placeholder="Shown as caption under the image" value="' + escapeHtml((item.storylineTitle != null ? item.storylineTitle : '')) + '">' +
        '<div class="row storyline-row"><label class="switch-label">Storyline (on preview)</label></div>' +
        '<textarea class="item-storyline" data-index="' + index + '" placeholder="Text shown in storyline when this content is previewed">' + escapeHtml((item.storyline != null ? item.storyline : '')) + '</textarea></div>' +
        '<div class="move-btns">' +
        (item.type === 'pdf' ? pdfThumbBtn : '') +
        '<button type="button" class="replace-item-btn" data-index="' + index + '" title="Replace media">Replace</button>' +
        (item.type === 'video' ? '<button type="button" class="retrim-item-btn" data-index="' + index + '" title="Change trim">Re-trim</button>' : '') +
        (item.type === 'video' ? '<button type="button" class="addcut-item-btn" data-index="' + index + '" title="Add another cut from this video (same file, new trim)">Add cut</button>' : '') +
        '<button type="button" class="move-btn" data-dir="up" data-index="' + index + '"' + (isFirst ? ' disabled' : '') + '>↑</button>' +
        '<button type="button" class="move-btn" data-dir="down" data-index="' + index + '"' + (isLast ? ' disabled' : '') + '>↓</button>' +
        '<button type="button" class="delete-item-btn" data-index="' + index + '" title="Remove from project">&#128465;</button></div></li>';
}

function render() {
    const ul = document.getElementById('playlist');
    ul.innerHTML = items.map((item, i) => renderItem(item, i)).join('');
    ul.querySelectorAll('.switch').forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.index, 10);
            if (el.dataset.defaultBg === '1') {
                items[idx].defaultBackgroundRoster = !items[idx].defaultBackgroundRoster;
            } else if (el.dataset.sound === '1') {
                items[idx].audioEnabled = !items[idx].audioEnabled;
            } else {
                items[idx].backgroundRoster = !items[idx].backgroundRoster;
            }
            render();
        });
    });
    ul.querySelectorAll('.move-btn').forEach(btn => {
        if (btn.disabled) return;
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index, 10);
            const dir = btn.dataset.dir;
            if (dir === 'up' && idx > 0) {
                [items[idx - 1], items[idx]] = [items[idx], items[idx - 1]];
            } else if (dir === 'down' && idx < items.length - 1) {
                [items[idx], items[idx + 1]] = [items[idx + 1], items[idx]];
            }
            render();
        });
    });
    ul.querySelectorAll('.delete-item-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index, 10);
            const itemName = items[idx] && items[idx].name ? items[idx].name : 'this item';
            if (!confirm('Remove "' + itemName + '" from the project?')) return;
            items.splice(idx, 1);
            render();
        });
    });
    ul.querySelectorAll('.replace-item-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index, 10);
            if (isNaN(idx) || !items[idx]) return;
            replaceIndex = idx;
            const input = document.getElementById('replaceFileInput');
            if (input) {
                const it = items[idx];
                if (it.type === 'pdf') input.accept = 'application/pdf';
                else if (it.type === 'image') input.accept = 'image/*';
                else input.accept = 'video/*';
                input.value = '';
                input.click();
            }
        });
    });
    ul.querySelectorAll('.set-pdf-thumb-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index, 10);
            if (isNaN(idx) || !items[idx] || items[idx].type !== 'pdf') return;
            openPdfThumbnailModal(idx);
        });
    });
    ul.querySelectorAll('.retrim-item-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index, 10);
            if (isNaN(idx) || !items[idx] || items[idx].type !== 'video') return;
            const it = items[idx];
            const src = getItemSrc(it);
            if (!src) return;
            openTrimModal(src, it.name, null, (trim) => {
                items[idx].trimStart = trim.trimStart;
                items[idx].trimEnd = trim.trimEnd;
                render();
            }, () => {});
        });
    });
    ul.querySelectorAll('.addcut-item-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index, 10);
            if (isNaN(idx) || !items[idx] || items[idx].type !== 'video') return;
            const item = items[idx];
            const src = getItemSrc(item);
            if (!src) return;
            function openAddCutModal() {
                const newIdx = idx + 1;
                const newItem = {
                    type: 'video',
                    assetId: item.assetId,
                    name: (item.name || 'Untitled') + ' (2)',
                    trimStart: 0,
                    trimEnd: null,
                    storyline: '',
                    storylineTitle: '',
                    backgroundRoster: false, defaultBackgroundRoster: false,
                    audioEnabled: false
                };
                openTrimModal(getItemSrc(item), newItem.name, null, (trim) => {
                    newItem.trimStart = trim.trimStart;
                    newItem.trimEnd = trim.trimEnd;
                    items.splice(newIdx, 0, newItem);
                    render();
                }, () => {});
            }
            if (!item.assetId) {
                const assetId = 'a' + Date.now();
                uploadDataUrl(projectId, src, 'source.webm', uploadProgressCallbacks()).then(assetUrl => {
                    const finalAssetSrc = assetUrl || src;
                    assets.push({ id: assetId, type: 'video', src: finalAssetSrc });
                    item.assetId = assetId;
                    delete item.src;
                    openAddCutModal();
                }).catch(err => alert(err && err.message ? err.message : 'Upload failed'));
            } else {
                openAddCutModal();
            }
        });
    });
    ul.querySelectorAll('.item-name').forEach(el => {
        const idx = parseInt(el.dataset.index, 10);
        if (isNaN(idx) || !items[idx]) return;
        el.addEventListener('blur', () => {
            const name = (el.textContent || '').trim() || items[idx].name;
            items[idx].name = name;
        });
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
        });
    });
    ul.querySelectorAll('.item-storyline-title').forEach(el => {
        const idx = parseInt(el.dataset.index, 10);
        if (isNaN(idx) || !items[idx]) return;
        items[idx].storylineTitle = (el.value || '').trim();
        el.addEventListener('input', () => { items[idx].storylineTitle = (el.value || '').trim(); });
        el.addEventListener('change', () => { items[idx].storylineTitle = (el.value || '').trim(); });
    });
    ul.querySelectorAll('.item-storyline').forEach(el => {
        const idx = parseInt(el.dataset.index, 10);
        if (isNaN(idx) || !items[idx]) return;
        items[idx].storyline = el.value;
        el.addEventListener('input', () => { items[idx].storyline = el.value; });
        el.addEventListener('change', () => { items[idx].storyline = el.value; });
    });
    makeSortable(ul);
    updateStorageDisplay();
}

function makeSortable(ul) {
    let draggedIndex = null;
    ul.querySelectorAll('li').forEach((li, index) => {
        const handle = li.querySelector('.drag-handle');
        if (handle) {
            handle.setAttribute('draggable', 'true');
            handle.addEventListener('dragstart', (e) => {
                draggedIndex = index;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(index));
                e.stopPropagation();
            });
        }
        li.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (draggedIndex === null) return;
            const to = index;
            if (draggedIndex === to) return;
            const moved = items.splice(draggedIndex, 1)[0];
            items.splice(to, 0, moved);
            draggedIndex = to;
            render();
        });
    });
    ul.addEventListener('dragend', () => { draggedIndex = null; });
}

document.getElementById('uploadZone').addEventListener('click', () => document.getElementById('fileInput').click());
document.getElementById('uploadZone').addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
document.getElementById('uploadZone').addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    addFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/') || f.type === 'application/pdf'));
});
document.getElementById('fileInput').addEventListener('change', (e) => {
    addFiles(Array.from(e.target.files || []));
    e.target.value = '';
});

document.getElementById('replaceFileInput').addEventListener('change', (e) => {
    const file = (e.target.files || [])[0];
    e.target.value = '';
    const idx = replaceIndex;
    replaceIndex = null;
    if (idx == null || isNaN(idx) || !items[idx] || !file) return;
    const item = items[idx];
    if (item.type === 'image') {
        if (!file.type.startsWith('image/')) {
            alert('Please choose an image file.');
            return;
        }
        uploadFile(projectId, file, uploadProgressCallbacks()).then(url => {
            const newSrc = url || null;
            if (!newSrc) {
                const reader = new FileReader();
                reader.onload = () => {
                    const data = getProjectDataSync(projectId);
                    data.assets = assets;
                    const nextItems = items.slice();
                    nextItems[idx] = { ...item, src: reader.result };
                    data.items = nextItems;
                    if (getProjectSizeBytes(data) > PROJECT_STORAGE_LIMIT_BYTES) {
                        alert('Replacing would exceed the project storage limit. Choose a smaller file or remove some content.');
                        return;
                    }
                    items[idx].src = reader.result;
                    render();
                };
                reader.readAsDataURL(file);
                return;
            }
            const data = getProjectDataSync(projectId);
            data.assets = assets;
            const nextItems = items.slice();
            nextItems[idx] = { ...item, src: newSrc };
            data.items = nextItems;
            if (getProjectSizeBytes(data) > PROJECT_STORAGE_LIMIT_BYTES) {
                alert('Replacing would exceed the project storage limit. Choose a smaller file or remove some content.');
                return;
            }
            items[idx].src = newSrc;
            render();
        }).catch(err => alert(err && err.message ? err.message : 'Upload failed'));
    } else if (item.type === 'pdf') {
        if (file.type !== 'application/pdf') {
            alert('Please choose a PDF file.');
            return;
        }
        uploadFile(projectId, file, uploadProgressCallbacks()).then(url => {
            if (url) {
                items[idx].src = url;
                items[idx].name = file.name || item.name;
                render();
                openPdfThumbnailModal(idx);
            } else {
                const reader = new FileReader();
                reader.onload = () => {
                    items[idx].src = reader.result;
                    items[idx].name = file.name || item.name;
                    render();
                    openPdfThumbnailModal(idx);
                };
                reader.readAsDataURL(file);
            }
        }).catch(err => alert(err && err.message ? err.message : 'Upload failed'));
    } else {
        if (!file.type.startsWith('video/')) {
            alert('Please choose a video file.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const videoSrc = reader.result;
            openTrimModal(videoSrc, file.name || item.name, file.size, (trim) => {
                uploadFile(projectId, file, uploadProgressCallbacks()).then(url => {
                    const src = url || videoSrc;
                    const data = getProjectDataSync(projectId);
                    data.assets = assets;
                    const nextItems = items.slice();
                    nextItems[idx] = { ...item, src, trimStart: trim.trimStart, trimEnd: trim.trimEnd };
                    delete nextItems[idx].assetId;
                    data.items = nextItems;
                    if (getProjectSizeBytes(data) > PROJECT_STORAGE_LIMIT_BYTES) {
                        alert('Replacing would exceed the project storage limit. Choose a shorter segment or remove some content.');
                        return;
                    }
                    items[idx].src = src;
                    delete items[idx].assetId;
                    items[idx].trimStart = trim.trimStart;
                    items[idx].trimEnd = trim.trimEnd;
                    render();
                }).catch(err => alert(err && err.message ? err.message : 'Upload failed'));
            }, () => {});
        };
        reader.readAsDataURL(file);
    }
});

let videoTrimQueue = [];
let replaceIndex = null;

/** State for PDF thumbnail modal: { pdfUrl, name } when adding new PDF, or { index } when setting thumbnail for existing. */
let pdfThumbnailPending = null;
/** Queue of { pdfUrl, name } after uploading PDFs in addFiles; process one at a time. */
let pdfThumbnailQueue = [];

function openPdfThumbnailModal(indexOrNewPdf) {
    const overlay = document.getElementById('pdfThumbnailOverlay');
    const titleEl = document.getElementById('pdfThumbnailTitle');
    if (!overlay || !titleEl) return;
    pdfThumbnailPending = indexOrNewPdf;
    if (typeof indexOrNewPdf === 'number') {
        const item = items[indexOrNewPdf];
        titleEl.textContent = item && item.name ? 'Change thumbnail: ' + item.name : 'Set thumbnail for PDF';
    } else {
        titleEl.textContent = indexOrNewPdf.name ? 'Set thumbnail for: ' + indexOrNewPdf.name : 'Set thumbnail for PDF';
    }
    overlay.classList.add('visible');
}

function processNextPdfInQueue() {
    if (pdfThumbnailQueue.length === 0) return;
    const next = pdfThumbnailQueue.shift();
    openPdfThumbnailModal(next);
}

function closePdfThumbnailModal() {
    const overlay = document.getElementById('pdfThumbnailOverlay');
    if (overlay) overlay.classList.remove('visible');
    pdfThumbnailPending = null;
}

function onPdfThumbnailChosen(thumbUrl) {
    if (pdfThumbnailPending == null) return;
    if (typeof pdfThumbnailPending === 'number') {
        const idx = pdfThumbnailPending;
        if (items[idx] && items[idx].type === 'pdf') {
            items[idx].thumbnail = thumbUrl;
            render();
        }
    } else {
        items.push({
            type: 'pdf',
            src: pdfThumbnailPending.pdfUrl,
            thumbnail: thumbUrl,
            name: pdfThumbnailPending.name || 'PDF',
            storyline: '',
            storylineTitle: '',
            backgroundRoster: false, defaultBackgroundRoster: false
        });
        render();
    }
    closePdfThumbnailModal();
    pdfThumbnailPending = null;
    processNextPdfInQueue();
}

function onPdfThumbnailSkipped() {
    if (pdfThumbnailPending == null) return;
    if (typeof pdfThumbnailPending === 'number') {
        closePdfThumbnailModal();
        pdfThumbnailPending = null;
        processNextPdfInQueue();
        return;
    }
    items.push({
        type: 'pdf',
        src: pdfThumbnailPending.pdfUrl,
        thumbnail: null,
        name: pdfThumbnailPending.name || 'PDF',
        storyline: '',
        storylineTitle: '',
        backgroundRoster: false, defaultBackgroundRoster: false
    });
    render();
    closePdfThumbnailModal();
    pdfThumbnailPending = null;
    processNextPdfInQueue();
}

document.getElementById('pdfThumbnailChooseBtn').addEventListener('click', () => document.getElementById('pdfThumbnailInput').click());
document.getElementById('pdfThumbnailSkipBtn').addEventListener('click', onPdfThumbnailSkipped);
document.getElementById('pdfThumbnailInput').addEventListener('change', (e) => {
    const file = (e.target.files || [])[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/') || !pdfThumbnailPending) return;
    uploadFile(projectId, file, uploadProgressCallbacks()).then(url => {
        if (url) onPdfThumbnailChosen(url);
        else {
            const reader = new FileReader();
            reader.onload = () => onPdfThumbnailChosen(reader.result);
            reader.readAsDataURL(file);
        }
    }).catch(err => alert(err && err.message ? err.message : 'Upload failed'));
});

function openTrimModal(videoSrc, name, fileSizeBytes, onAdd, onCancel) {
    const overlay = document.getElementById('trimOverlay');
    const video = document.getElementById('trimPreviewVideo');
    const startRange = document.getElementById('trimStartRange');
    const endRange = document.getElementById('trimEndRange');
    const startLabel = document.getElementById('trimStartLabel');
    const endLabel = document.getElementById('trimEndLabel');
    const durationLabel = document.getElementById('trimDurationLabel');
    const sizeLabel = document.getElementById('trimSizeLabel');
    const playPauseBtn = document.getElementById('trimPlayPauseBtn');
    const addBtn = document.getElementById('trimAddBtn');
    const cancelBtn = document.getElementById('trimCancelBtn');
    if (!overlay || !video || !startRange || !endRange) return;

    video.src = videoSrc;
    video.load();
    let duration = 0;
    let trimStart = 0;
    let trimEnd = 10;
    let trimTimeupdate = null;
    var fileSize = (fileSizeBytes != null && isFinite(fileSizeBytes)) ? fileSizeBytes : 0;

    function formatTime(s) {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return m + ':' + String(sec).padStart(2, '0');
    }

    function formatSize(bytes) {
        if (!bytes) return '—';
        if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return bytes + ' B';
    }

    function updateLabels() {
        startLabel.textContent = 'Start: ' + formatTime(trimStart);
        endLabel.textContent = 'End: ' + formatTime(trimEnd);
        durationLabel.textContent = 'Duration: ' + formatTime(Math.max(0, trimEnd - trimStart));
        if (sizeLabel) {
            var fullSize = formatSize(fileSize);
            if (duration > 0 && fileSize > 0 && trimEnd > trimStart) {
                var segmentRatio = (trimEnd - trimStart) / duration;
                var segmentBytes = Math.round(fileSize * segmentRatio);
                sizeLabel.textContent = 'Size: ' + fullSize + ' (trimmed: ~' + formatSize(segmentBytes) + ')';
            } else {
                sizeLabel.textContent = 'Size: ' + fullSize;
            }
        }
    }

    function applyTrimToInputs() {
        startRange.value = trimStart;
        endRange.value = trimEnd;
        updateLabels();
    }

    video.addEventListener('loadedmetadata', () => {
        duration = video.duration;
        if (!isFinite(duration) || duration <= 0) duration = 60;
        trimEnd = Math.min(trimEnd, duration);
        startRange.max = duration;
        startRange.value = 0;
        endRange.max = duration;
        endRange.value = trimEnd;
        trimStart = 0;
        applyTrimToInputs();
    });

    startRange.addEventListener('input', () => {
        trimStart = parseFloat(startRange.value) || 0;
        if (trimStart >= trimEnd) trimEnd = Math.min(trimStart + 1, duration);
        endRange.min = trimStart;
        endRange.value = trimEnd;
        video.currentTime = trimStart;
        updateLabels();
    });
    endRange.addEventListener('input', () => {
        trimEnd = parseFloat(endRange.value) || duration;
        if (trimEnd <= trimStart) trimStart = Math.max(0, trimEnd - 1);
        startRange.max = trimEnd;
        startRange.value = trimStart;
        updateLabels();
    });

    trimTimeupdate = () => {
        if (video.currentTime >= trimEnd) {
            video.pause();
            video.currentTime = trimStart;
            playPauseBtn.textContent = 'Play';
        }
    };
    video.addEventListener('timeupdate', trimTimeupdate);

    playPauseBtn.onclick = () => {
        if (video.paused) {
            video.currentTime = Math.max(trimStart, video.currentTime);
            if (video.currentTime >= trimEnd) video.currentTime = trimStart;
            video.play();
            playPauseBtn.textContent = 'Pause';
        } else {
            video.pause();
            playPauseBtn.textContent = 'Play';
        }
    };

    addBtn.onclick = () => {
        video.pause();
        video.removeEventListener('timeupdate', trimTimeupdate);
        overlay.classList.remove('visible');
        video.src = '';
        onAdd({ trimStart, trimEnd });
    };

    cancelBtn.onclick = () => {
        video.pause();
        video.removeEventListener('timeupdate', trimTimeupdate);
        overlay.classList.remove('visible');
        video.src = '';
        onCancel();
    };

    overlay.classList.add('visible');
    updateLabels();
}

function addFiles(files) {
    if (files.length === 0) return;
    const currentData = { name: getProjectDataSync(projectId).name, items: items.slice(), assets: assets.slice() };
    let addSize = 0;
    for (let i = 0; i < files.length; i++) addSize += files[i].size || 0;
    if (getProjectSizeBytes(currentData) + addSize > PROJECT_STORAGE_LIMIT_BYTES) {
        alert('Adding these files would exceed the project storage limit of ' + (PROJECT_STORAGE_LIMIT_BYTES / (1024 * 1024)).toFixed(0) + ' MB. Remove some content or add smaller files.');
        return;
    }
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    const videoFiles = files.filter(f => f.type.startsWith('video/'));
    const pdfFiles = files.filter(f => f.type === 'application/pdf');
    imageFiles.forEach(file => {
        const name = file.name || 'Untitled';
        uploadFile(projectId, file, uploadProgressCallbacks()).then(url => {
            if (url) {
                items.push({ type: 'image', src: url, name, storylineTitle: '', backgroundRoster: false, defaultBackgroundRoster: false });
                render();
            } else {
                const reader = new FileReader();
                reader.onload = () => {
                    items.push({ type: 'image', src: reader.result, name, storylineTitle: '', backgroundRoster: false, defaultBackgroundRoster: false });
                    render();
                };
                reader.readAsDataURL(file);
            }
        }).catch(err => alert(err && err.message ? err.message : 'Upload failed'));
    });
    pdfFiles.forEach(file => {
        const name = file.name || 'PDF';
        uploadFile(projectId, file, uploadProgressCallbacks()).then(url => {
            if (url) {
                pdfThumbnailQueue.push({ pdfUrl: url, name });
                if (pdfThumbnailQueue.length === 1 && !document.getElementById('pdfThumbnailOverlay').classList.contains('visible')) processNextPdfInQueue();
            } else {
                const reader = new FileReader();
                reader.onload = () => {
                    pdfThumbnailQueue.push({ pdfUrl: reader.result, name });
                    if (pdfThumbnailQueue.length === 1 && !document.getElementById('pdfThumbnailOverlay').classList.contains('visible')) processNextPdfInQueue();
                };
                reader.readAsDataURL(file);
            }
        }).catch(err => alert(err && err.message ? err.message : 'Upload failed'));
    });
    if (videoFiles.length === 0 && pdfFiles.length === 0) return;
    videoTrimQueue = videoFiles.slice();
    function processNextVideo() {
        if (videoTrimQueue.length === 0) {
            render();
            return;
        }
        const file = videoTrimQueue.shift();
        const name = file.name || 'Untitled';
        const reader = new FileReader();
        reader.onload = () => {
            const videoSrc = reader.result;
            openTrimModal(videoSrc, name, file.size, (trim) => {
                uploadFile(projectId, file, uploadProgressCallbacks()).then(url => {
                    const src = url || videoSrc;
                    const newItem = {
                        type: 'video',
                        src,
                        name,
                        storylineTitle: '',
                        backgroundRoster: false, defaultBackgroundRoster: false,
                        audioEnabled: false,
                        trimStart: trim.trimStart,
                        trimEnd: trim.trimEnd
                    };
                    const data = getProjectDataSync(projectId);
                    data.items = items.concat([newItem]);
                    data.assets = assets;
                    if (getProjectSizeBytes(data) > PROJECT_STORAGE_LIMIT_BYTES) {
                        alert('The trimmed clip would exceed the project storage limit. Remove some content or choose a shorter segment.');
                        processNextVideo();
                        return;
                    }
                    items.push(newItem);
                    processNextVideo();
                }).catch(err => { alert(err && err.message ? err.message : 'Upload failed'); processNextVideo(); });
            }, () => {
                processNextVideo();
            });
        };
        reader.onerror = () => processNextVideo();
        reader.readAsDataURL(file);
    }
    processNextVideo();
}

function updateStorageDisplay() {
    const data = getProjectDataSync(projectId);
    data.items = items;
    data.assets = assets;
    const bytes = getProjectSizeBytes(data);
    const el = document.getElementById('storageUsage');
    if (el) el.textContent = 'Storage: ' + (bytes / (1024 * 1024)).toFixed(1) + ' / ' + (PROJECT_STORAGE_LIMIT_BYTES / (1024 * 1024)).toFixed(0) + ' MB';
}

function updateThumbnailPreview(src) {
    const preview = document.getElementById('thumbnailPreview');
    const placeholder = document.getElementById('thumbnailPlaceholder');
    const clearBtn = document.getElementById('thumbnailClearBtn');
    if (preview) { preview.src = src || ''; preview.style.display = src ? 'block' : 'none'; }
    if (placeholder) placeholder.style.display = src ? 'none' : 'block';
    if (clearBtn) clearBtn.style.display = src ? 'inline-block' : 'none';
}

function updateDefaultBackgroundPreview(src) {
    const imgEl = document.getElementById('defaultBackgroundPreviewImg');
    const videoEl = document.getElementById('defaultBackgroundPreviewVideo');
    const placeholder = document.getElementById('defaultBackgroundPlaceholder');
    const clearBtn = document.getElementById('defaultBackgroundClearBtn');
    const isVideo = src && (/\.(mp4|webm|ogg)(\?|$)/i.test(src) || src.startsWith('data:video'));
    if (imgEl) { imgEl.src = !isVideo ? (src || '') : ''; imgEl.style.display = src && !isVideo ? 'block' : 'none'; }
    if (videoEl) {
        videoEl.src = isVideo ? (src || '') : '';
        videoEl.style.display = isVideo && src ? 'block' : 'none';
        if (isVideo && src) videoEl.load();
    }
    if (placeholder) placeholder.style.display = src ? 'none' : 'block';
    if (clearBtn) clearBtn.style.display = src ? 'inline-block' : 'none';
}

document.getElementById('thumbnailChooseBtn').addEventListener('click', () => document.getElementById('thumbnailInput').click());
document.getElementById('thumbnailInput').addEventListener('change', (e) => {
    const file = (e.target.files || [])[0];
    if (!file || !file.type.startsWith('image/')) return;
    uploadFile(projectId, file, uploadProgressCallbacks()).then(url => {
        if (url) {
            thumbnailDataUrl = url;
            updateThumbnailPreview(thumbnailDataUrl);
        } else {
            const reader = new FileReader();
            reader.onload = () => {
                thumbnailDataUrl = reader.result;
                updateThumbnailPreview(thumbnailDataUrl);
            };
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    }).catch(err => alert(err && err.message ? err.message : 'Upload failed'));
});
document.getElementById('thumbnailClearBtn').addEventListener('click', () => {
    thumbnailDataUrl = null;
    updateThumbnailPreview(null);
});

document.getElementById('defaultBackgroundChooseBtn').addEventListener('click', () => document.getElementById('defaultBackgroundInput').click());
document.getElementById('defaultBackgroundInput').addEventListener('change', (e) => {
    const file = (e.target.files || [])[0];
    if (!file || (!file.type.startsWith('image/') && !file.type.startsWith('video/'))) return;
    uploadFile(projectId, file, uploadProgressCallbacks()).then(url => {
        if (url) {
            defaultBackgroundUrl = url;
            updateDefaultBackgroundPreview(defaultBackgroundUrl);
        } else {
            const reader = new FileReader();
            reader.onload = () => {
                defaultBackgroundUrl = reader.result;
                updateDefaultBackgroundPreview(defaultBackgroundUrl);
            };
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    }).catch(err => alert(err && err.message ? err.message : 'Upload failed'));
});
document.getElementById('defaultBackgroundClearBtn').addEventListener('click', () => {
    defaultBackgroundUrl = null;
    updateDefaultBackgroundPreview(null);
});

document.getElementById('saveBtn').addEventListener('click', () => {
    const btn = document.getElementById('saveBtn');
    const originalText = btn.textContent;
    const data = getProjectDataSync(projectId);
    data.items = items;
    data.assets = assets;
    data.name = (document.getElementById('projectNameInput') || {}).value || data.name || ('Project ' + projectId);
    data.storyline = (document.getElementById('projectStoryline') || {}).value || '';
    data.storylineTitle = (document.getElementById('projectStorylineTitle') || {}).value || '';
    data.thumbnail = thumbnailDataUrl;
    data.defaultBackgroundUrl = defaultBackgroundUrl;
    if (getProjectSizeBytes(data) > PROJECT_STORAGE_LIMIT_BYTES) {
        alert('Project size exceeds the ' + (PROJECT_STORAGE_LIMIT_BYTES / (1024 * 1024)).toFixed(0) + ' MB limit. Remove some content to save.');
        return;
    }
    btn.textContent = 'Saving…';
    btn.disabled = true;
    saveProject({ id: projectId, name: data.name, items: data.items, storyline: data.storyline, storylineTitle: data.storylineTitle, thumbnail: data.thumbnail, defaultBackgroundUrl: data.defaultBackgroundUrl, assets: data.assets, layout: projectLayout, caseStudy: projectCaseStudy }).then(() => {
        const list = getProjectList();
        const idx = list.findIndex(p => String(p.id) === String(projectId));
        const entry = { id: projectId, name: data.name, thumbnail: data.thumbnail || null };
        if (idx >= 0) {
            list[idx] = Object.assign(list[idx], entry);
        } else {
            list.push(entry);
        }
        saveProjectList(list);
        btn.textContent = 'Saved';
        setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 1500);
    }).catch((e) => {
        btn.disabled = false;
        const msg = e && e.message ? e.message : (e.name === 'QuotaExceededError' ? 'Storage full' : 'Error');
        const isTooLarge = msg.indexOf('too large') !== -1;
        btn.textContent = isTooLarge ? 'Saved locally only' : 'Sync failed';
        const dataSizeMB = (getProjectSizeBytes({ name: data.name, items: data.items, storyline: data.storyline, storylineTitle: data.storylineTitle, thumbnail: data.thumbnail, defaultBackgroundUrl: data.defaultBackgroundUrl, assets: data.assets }) / (1024 * 1024)).toFixed(1);
        const hint = isTooLarge
            ? 'Your project is about ' + dataSizeMB + ' MB (cloud limit 4.5 MB). Set up Supabase Storage so media is stored in the cloud and only links are saved here, or remove some content.'
            : 'Check your connection and try again.';
        alert('Saved on this device only.\n\nCloud sync failed: ' + msg + '\n\n' + hint);
        setTimeout(() => { btn.textContent = originalText; }, 3000);
    });
});

document.getElementById('pageTitle').textContent = 'Edit Project ' + projectId;

(function loadProject() {
    showLoadingScreen('Edit Project');
    getProject(projectId).then(record => {
        if (record && record.items && record.items.length >= 0) {
            items = record.items.slice();
            assets = Array.isArray(record.assets) ? record.assets.slice() : [];
            projectLayout = record.layout || 'deck';
            projectCaseStudy = record.caseStudy || null;
            if (record.name) document.getElementById('pageTitle').textContent = 'Edit ' + record.name;
            const nameEl = document.getElementById('projectNameInput');
            if (nameEl && record.name != null) nameEl.value = record.name || '';
            const storyEl = document.getElementById('projectStoryline');
            if (storyEl && record.storyline != null) storyEl.value = record.storyline || '';
            const storyTitleEl = document.getElementById('projectStorylineTitle');
            if (storyTitleEl && record.storylineTitle != null) storyTitleEl.value = record.storylineTitle || '';
            if (record.thumbnail) { thumbnailDataUrl = record.thumbnail; updateThumbnailPreview(thumbnailDataUrl); }
            if (record.defaultBackgroundUrl) { defaultBackgroundUrl = record.defaultBackgroundUrl; updateDefaultBackgroundPreview(defaultBackgroundUrl); }
        } else {
            const fallback = getProjectDataSync(projectId);
            items = (fallback.items || []).slice();
            assets = Array.isArray(fallback.assets) ? fallback.assets.slice() : [];
            projectLayout = fallback.layout || 'deck';
            projectCaseStudy = fallback.caseStudy || null;
            const nameEl = document.getElementById('projectNameInput');
            if (nameEl && fallback.name != null) nameEl.value = fallback.name || '';
            const storyEl = document.getElementById('projectStoryline');
            if (storyEl && fallback.storyline != null) storyEl.value = fallback.storyline || '';
            const storyTitleEl = document.getElementById('projectStorylineTitle');
            if (storyTitleEl && fallback.storylineTitle != null) storyTitleEl.value = fallback.storylineTitle || '';
            if (fallback.thumbnail) { thumbnailDataUrl = fallback.thumbnail; updateThumbnailPreview(thumbnailDataUrl); }
            if (fallback.defaultBackgroundUrl) { defaultBackgroundUrl = fallback.defaultBackgroundUrl; updateDefaultBackgroundPreview(defaultBackgroundUrl); }
        }
        render();
        hideLoadingScreen({ label: (record && record.name) || ('Project ' + projectId) });
    }).catch(() => {
        const fallback = getProjectDataSync(projectId);
        items = (fallback.items || []).slice();
        assets = Array.isArray(fallback.assets) ? fallback.assets.slice() : [];
        projectLayout = fallback.layout || 'deck';
        projectCaseStudy = fallback.caseStudy || null;
        const nameEl = document.getElementById('projectNameInput');
        if (nameEl && fallback.name != null) nameEl.value = fallback.name || '';
        const storyEl = document.getElementById('projectStoryline');
        if (storyEl && fallback.storyline != null) storyEl.value = fallback.storyline || '';
        const storyTitleEl = document.getElementById('projectStorylineTitle');
        if (storyTitleEl && fallback.storylineTitle != null) storyTitleEl.value = fallback.storylineTitle || '';
        if (fallback.thumbnail) { thumbnailDataUrl = fallback.thumbnail; updateThumbnailPreview(thumbnailDataUrl); }
        if (fallback.defaultBackgroundUrl) { defaultBackgroundUrl = fallback.defaultBackgroundUrl; updateDefaultBackgroundPreview(defaultBackgroundUrl); }
        render();
        hideLoadingScreen({ label: fallback.name || ('Project ' + projectId) });
    });
})();

init();
