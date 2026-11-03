import express from 'express';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'node:crypto';
import {
    buildAvailability,
    validateBookingInput,
    validateWaitlistInput
} from './netlify/lib/bookingShared.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.disable('x-powered-by');
app.use(compression());
// NOTE: no CORS middleware. The site and its API share an origin; a wildcard
// CORS policy would let any website read this API with a visitor's browser.
app.use(express.json({ limit: '100kb' }));

// ── Security headers (mirrors the production _headers file) ───────────────────
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    // Mirrors _headers, minus upgrade-insecure-requests/HSTS which would break
    // http://localhost during development.
    res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "img-src 'self' data: https:",
        "media-src 'self' https:",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' data: https://fonts.gstatic.com",
        "script-src 'self'",
        "worker-src 'self' blob:",
        "connect-src 'self'",
        "frame-src 'self' blob:",
        "frame-ancestors 'none'",
        "form-action 'self'"
    ].join('; '));
    next();
});

// ── Paths that must never be served ───────────────────────────────────────────
// src/data/bookings.json and src/data/waitlist.json contain personal data
// (names, emails); netlify/ and node_modules/ contain server-side code.
const BLOCKED_PREFIXES = ['/netlify', '/node_modules', '/_deprecated', '/_archive', '/docs', '/.git', '/src/data/bookings.json', '/src/data/waitlist.json'];
const BLOCKED_FILES = ['/server.mjs', '/package.json', '/package-lock.json', '/netlify.toml', '/README.md', '/SECURITY_REPORT.md'];
app.use((req, res, next) => {
    const p = req.path.replace(/^\/cappuccinostudiox/, '').replace(/\/+$/, '') || '/';
    const blocked = BLOCKED_FILES.includes(p)
        || p.startsWith('/.')
        || BLOCKED_PREFIXES.some(prefix => p === prefix || p.startsWith(prefix + '/') || p === prefix + '.json');
    if (blocked) return res.status(404).send('Not Found');
    next();
});

// ── Admin guard for write routes ─────────────────────────────────────────────
// SECRET — SET IN NETLIFY ENV: ADMIN_TOKEN (local dev: export ADMIN_TOKEN=...)
function checkAdmin(req) {
    const expected = process.env.ADMIN_TOKEN;
    const provided = String(req.get('x-admin-token') || '');
    if (!expected) {
        // No token configured on this checkout: allow loopback only.
        const ip = req.ip || '';
        const local = ip === '' || ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1';
        return local ? { ok: true } : { ok: false, status: 503, error: 'ADMIN_TOKEN is not configured on this server.' };
    }
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return { ok: false, status: 401, error: 'Admin token required.' };
    }
    return { ok: true };
}

function requireAdmin(req, res, next) {
    const result = checkAdmin(req);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    next();
}

// ── Spam guard for public forms ──────────────────────────────────────────────
const submissionLog = new Map();

function rateLimited(req, action, limit, windowMs) {
    const key = action + ':' + (req.ip || 'unknown');
    const now = Date.now();
    const entry = submissionLog.get(key);
    if (!entry || entry.resetAt <= now) {
        submissionLog.set(key, { count: 1, resetAt: now + windowMs });
        return false;
    }
    entry.count += 1;
    return entry.count > limit;
}

function isBotSubmission(body) {
    if (!body || typeof body !== 'object') return false;
    const value = body.botField ?? body['bot-field'];
    return typeof value === 'string' && value.trim() !== '';
}

// ── Static files ───────────────────────────────────────────────────────────────
// Serve local project assets at /assets/projects (before the catch-all static)
app.use('/assets/projects', express.static(path.join(__dirname, 'public/assets/projects'), {
    maxAge: '30d',
    immutable: true
}));
// Same assets when the app is opened through the /cappuccinostudiox subpath.
app.use('/cappuccinostudiox/assets', express.static(path.join(__dirname, 'public/assets'), {
    maxAge: '30d',
    immutable: true
}));
// Netlify clean URLs (from netlify.toml) so /kitchen, /work, /offers and
// /contact resolve in local dev exactly as they do in production.
const CLEAN_URLS = {
    '/work': 'project-files.html',
    '/offers': 'offers.html',
    '/kitchen': 'kitchen.html',
    '/contact': 'booking.html'
};
app.get(Object.keys(CLEAN_URLS), (req, res) => {
    res.sendFile(path.join(__dirname, CLEAN_URLS[req.path]));
});
app.get(['/studio', '/studio.html'], (req, res) => res.redirect(301, '/'));
// Serve everything else (HTML, JS, CSS, images, fonts, scenes)
app.use(express.static(__dirname, {
    extensions: ['html'],
    maxAge: '1h',
    setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        } else if (/\.(js|mjs|css)$/.test(filePath)) {
            // Modules are imported by bare path (no hash), so a stale core.js/ui.js
            // would silently kill the menu after an edit. Always revalidate.
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        } else if (/\.(woff2?|ttf|otf|eot)$/.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=2592000');
        }
    }
}));

// ── Helper: read projects.json ─────────────────────────────────────────────────
const PROJECTS_PATH = path.join(__dirname, 'src', 'data', 'projects.json');

function readProjects() {
    return JSON.parse(fs.readFileSync(PROJECTS_PATH, 'utf8'));
}

function writeProjects(data) {
    fs.writeFileSync(PROJECTS_PATH, JSON.stringify(data, null, 2));
}

/**
 * Shared by BOTH project-write routes (root and /cappuccinostudiox mirror) and
 * deliberately mirrors netlify/lib/blobStore.js saveProjectPersistent(), which
 * already requires a URL-safe id. The routes used to push req.body verbatim, so
 * any authenticated probe with a body like {"name":"x"} appended a junk card
 * that the dev server then served as a real project. Keeping the rule in one
 * function stops the two routes (and production) from drifting apart again.
 */
function saveProjectRecord(body) {
    if (!body || typeof body !== 'object' || body.id == null || body.id === '') {
        return { ok: false, status: 400, error: 'Project id is required.' };
    }
    const id = String(body.id).trim();
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) {
        return { ok: false, status: 400, error: 'Project id must be 1-40 letters, digits, - or _.' };
    }
    const data = readProjects();
    const record = { ...body, id };
    const idx = data.findIndex(p => String(p.id) === id);
    if (idx >= 0) data[idx] = record;
    else data.push(record);
    writeProjects(data);
    return { ok: true };
}

// ── Helper: read/write site config (local JSON) ───────────────────────────────
const SITE_CONFIG_PATH = path.join(__dirname, 'src', 'data', 'site-config.json');

function readSiteConfig() {
    try { return JSON.parse(fs.readFileSync(SITE_CONFIG_PATH, 'utf8')); }
    catch { return {}; }
}

function writeSiteConfig(cfg) {
    fs.writeFileSync(SITE_CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

// ── Helper: read/write bookings (local JSON) ──────────────────────────────────
const BOOKINGS_PATH = path.join(__dirname, 'src', 'data', 'bookings.json');

function readBookings() {
    try { return JSON.parse(fs.readFileSync(BOOKINGS_PATH, 'utf8')); }
    catch { return []; }
}

function writeBookings(data) {
    fs.writeFileSync(BOOKINGS_PATH, JSON.stringify(data, null, 2));
}

// ── Helper: read/write waitlist (local JSON) ──────────────────────────────────
const WAITLIST_PATH = path.join(__dirname, 'src', 'data', 'waitlist.json');

function readWaitlist() {
    try { return JSON.parse(fs.readFileSync(WAITLIST_PATH, 'utf8')); }
    catch { return []; }
}

function writeWaitlist(data) {
    fs.writeFileSync(WAITLIST_PATH, JSON.stringify(data, null, 2));
}

// ══════════════════════════════════════════════════════════════════════════════
//  API ROUTES — all local, zero external dependencies
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/local/projects — project list
app.get('/api/local/projects', (req, res) => {
    try {
        const data = readProjects();
        res.json(data.map(p => ({
            id: p.id,
            name: p.name,
            thumbnail: p.thumbnail || null,
            deckThumbnail: p.deckThumbnail || p.deck_thumbnail || null,
            discipline: (p.caseStudy && p.caseStudy.discipline) || p.discipline || null,
            layout: p.layout || 'deck'
        })));
    } catch (e) {
        res.status(500).json({ error: 'Failed to load projects' });
    }
});

// GET /api/local/projects/:id — single project
app.get('/api/local/projects/:id', (req, res) => {
    try {
        const data = readProjects();
        const project = data.find(p => String(p.id) === String(req.params.id));
        if (!project) return res.status(404).json({ error: 'Project not found' });
        res.json(project);
    } catch (e) {
        res.status(500).json({ error: 'Failed to load project' });
    }
});

// POST /api/local/projects — save project
app.post('/api/local/projects', requireAdmin, (req, res) => {
    try {
        const result = saveProjectRecord(req.body);
        if (!result.ok) return res.status(result.status).json({ error: result.error });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to save project' });
    }
});

// GET /api/project-files-config — 3D box config
app.get('/api/project-files-config', (req, res) => {
    try {
        const cfg = readSiteConfig();
        res.json({ config: cfg.project_files_3d || null });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/project-files-config — save 3D box config
app.post('/api/project-files-config', requireAdmin, (req, res) => {
    try {
        const cfg = readSiteConfig();
        cfg.project_files_3d = req.body.config || req.body;
        writeSiteConfig(cfg);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/availability — next 15 weekday slots in the studio timezone
app.get('/api/availability', (req, res) => {
    try {
        res.json(buildAvailability(readBookings()));
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/admin/session — token probe for the admin UI (no PII returned)
app.get(['/api/admin/session', '/cappuccinostudiox/api/admin/session'], requireAdmin, (req, res) => {
    res.json({ ok: true, admin: true });
});

// POST /api/bookings — validate, reject double-bookings, persist
app.post('/api/bookings', (req, res) => {
    try {
        // Honeypot + per-IP rate limit: see isBotSubmission/rateLimited above.
        if (isBotSubmission(req.body)) return res.json({ ok: true });
        if (rateLimited(req, 'bookings', 8, 60 * 60 * 1000)) {
            return res.status(429).json({ error: 'Too many submissions. Please try again later.', code: 'RATE_LIMITED' });
        }
        const bookings = readBookings();
        const result = validateBookingInput(req.body, bookings);
        if (!result.ok) return res.status(result.status).json({ error: result.error, code: result.code });
        bookings.push(result.booking);
        writeBookings(bookings);
        res.status(201).json({ ok: true, booking: result.booking });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/waitlist — validate email and de-duplicate by address
app.post('/api/waitlist', (req, res) => {
    try {
        // Honeypot + per-IP rate limit: see isBotSubmission/rateLimited above.
        if (isBotSubmission(req.body)) return res.json({ ok: true });
        if (rateLimited(req, 'waitlist', 5, 60 * 60 * 1000)) {
            return res.status(429).json({ error: 'Too many submissions. Please try again later.', code: 'RATE_LIMITED' });
        }
        const result = validateWaitlistInput(req.body);
        if (!result.ok) return res.status(result.status).json({ error: result.error, code: result.code });
        const list = readWaitlist();
        const existing = list.find((entry) => String(entry.email || '').toLowerCase() === result.entry.email);
        if (existing) return res.json({ ok: true, duplicate: true, entry: existing });
        list.push(result.entry);
        writeWaitlist(list);
        res.status(201).json({ ok: true, duplicate: false, entry: result.entry });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/bookings + /api/waitlist — admin-only listings (parity with api.js).
// The public forms only ever POST; reading stored PII requires the admin token.
app.get(['/api/bookings', '/cappuccinostudiox/api/bookings'], requireAdmin, (req, res) => {
    try {
        res.json({ bookings: readBookings() });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get(['/api/waitlist', '/cappuccinostudiox/api/waitlist'], requireAdmin, (req, res) => {
    try {
        res.json({ waitlist: readWaitlist() });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/upload — local file upload (replaces Supabase Storage)
// Uses multipart form: fields "projectId" + "file"
let multer;
try {
    multer = (await import('multer')).default;
} catch {
    console.warn('⚠️  multer not installed — file uploads disabled. Run: npm install multer');
}

if (multer) {
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            // projectId is user input and used to reach path.join() raw, which
            // allowed directory traversal on upload. Keep it to a safe alphabet.
            const pid = String(req.body.projectId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) || 'unknown';
            const dir = path.join(__dirname, 'public', 'assets', 'projects', pid);
            fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            const unique = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
            const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
            cb(null, `${unique}-${safe}`);
        }
    });
    const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024, files: 1 } });

    app.post('/api/upload', requireAdmin, upload.single('file'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const pid = String(req.body.projectId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) || 'unknown';
        const url = `/assets/projects/${pid}/${req.file.filename}`;
        res.json({ url, filename: req.file.filename });
    });
}

// ── Cappuccino Studios API routes ──────────────────────────────────────────────
// The portfolio JS uses __BASE_PATH='/cappuccinostudiox' so API calls come as
// /cappuccinostudiox/api/... — these need to be handled BEFORE the static middleware
app.get('/cappuccinostudiox/api/local/projects', (req, res) => {
    try {
        const data = readProjects();
        res.json(data.map(p => ({
            id: p.id,
            name: p.name,
            thumbnail: p.thumbnail || null,
            deckThumbnail: p.deckThumbnail || p.deck_thumbnail || null,
            discipline: (p.caseStudy && p.caseStudy.discipline) || p.discipline || null,
            layout: p.layout || 'deck'
        })));
    } catch (e) {
        res.status(500).json({ error: 'Failed to load projects' });
    }
});
app.get('/cappuccinostudiox/api/local/projects/:id', (req, res) => {
    try {
        const data = readProjects();
        const project = data.find(p => String(p.id) === String(req.params.id));
        if (!project) return res.status(404).json({ error: 'Project not found' });
        res.json(project);
    } catch (e) {
        res.status(500).json({ error: 'Failed to load project' });
    }
});
app.post('/cappuccinostudiox/api/local/projects', requireAdmin, (req, res) => {
    try {
        const result = saveProjectRecord(req.body);
        if (!result.ok) return res.status(result.status).json({ error: result.error });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to save project' });
    }
});
app.get('/cappuccinostudiox/api/project-files-config', (req, res) => {
    try {
        const cfg = readSiteConfig();
        res.json({ config: cfg.project_files_3d || null });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});
app.post('/cappuccinostudiox/api/project-files-config', requireAdmin, (req, res) => {
    try {
        const cfg = readSiteConfig();
        cfg.project_files_3d = req.body.config || req.body;
        writeSiteConfig(cfg);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});
app.get('/cappuccinostudiox/api/availability', (req, res) => {
    try {
        res.json(buildAvailability(readBookings()));
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});
app.post('/cappuccinostudiox/api/bookings', (req, res) => {
    try {
        // Honeypot + per-IP rate limit: see isBotSubmission/rateLimited above.
        if (isBotSubmission(req.body)) return res.json({ ok: true });
        if (rateLimited(req, 'bookings', 8, 60 * 60 * 1000)) {
            return res.status(429).json({ error: 'Too many submissions. Please try again later.', code: 'RATE_LIMITED' });
        }
        const bookings = readBookings();
        const result = validateBookingInput(req.body, bookings);
        if (!result.ok) return res.status(result.status).json({ error: result.error, code: result.code });
        bookings.push(result.booking);
        writeBookings(bookings);
        res.status(201).json({ ok: true, booking: result.booking });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});
app.post('/cappuccinostudiox/api/waitlist', (req, res) => {
    try {
        // Honeypot + per-IP rate limit: see isBotSubmission/rateLimited above.
        if (isBotSubmission(req.body)) return res.json({ ok: true });
        if (rateLimited(req, 'waitlist', 5, 60 * 60 * 1000)) {
            return res.status(429).json({ error: 'Too many submissions. Please try again later.', code: 'RATE_LIMITED' });
        }
        const result = validateWaitlistInput(req.body);
        if (!result.ok) return res.status(result.status).json({ error: result.error, code: result.code });
        const list = readWaitlist();
        const existing = list.find((entry) => String(entry.email || '').toLowerCase() === result.entry.email);
        if (existing) return res.json({ ok: true, duplicate: true, entry: existing });
        list.push(result.entry);
        writeWaitlist(list);
        res.status(201).json({ ok: true, duplicate: false, entry: result.entry });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ── Cappuccino Studios static files ─────────────────────────────────────────────
// Serve the portfolio site when accessed via /cappuccinostudiox/ from the CONSOLIDATED client
app.use('/cappuccinostudiox', express.static(__dirname, {
    maxAge: '1h',
    setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        } else if (/\.(js|mjs|css)$/.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        } else if (/\.(woff2?|ttf|otf|eot)$/.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=2592000');
        }
    }
}));
// Fallback: serve index.html for any unmatched /cappuccinostudiox/ path (SPA support)
app.use('/cappuccinostudiox', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Fallback ───────────────────────────────────────────────────────────────────
app.use((req, res) => {
    // Confine the fallback to the project root. path.join(__dirname, req.path)
    // previously honoured "../" so /../../etc/passwd-style requests escaped.
    let decoded = req.path;
    try {
        decoded = decodeURIComponent(req.path);
    } catch {
        return res.status(404).send('Not Found');
    }
    const filePath = path.resolve(__dirname, '.' + decoded);
    if (filePath !== __dirname && !filePath.startsWith(__dirname + path.sep)) {
        return res.status(404).send('Not Found');
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return res.sendFile(filePath);
    }
    res.status(404).send('Not Found');
});

// ── Start ──────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8082;
app.listen(PORT, () => {
    console.log(`\n🚀 Portfolio server running at http://localhost:${PORT}`);
    console.log(`📁 Serving static files from: ${__dirname}`);
    console.log(`📦 Data: ${PROJECTS_PATH}`);
    console.log(`🎨 Assets: ${path.join(__dirname, 'public/assets/projects')}`);
});
