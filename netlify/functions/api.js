import { buildAvailability, STUDIO_TIMEZONE } from '../lib/bookingShared.js';
import {
  listBookingsPersistent,
  createBookingPersistent,
  cancelBookingPersistent,
  rescheduleBookingPersistent,
  joinWaitlistPersistent,
  listWaitlistPersistent,
  listProjectsPersistent,
  getProjectPersistent,
  saveProjectPersistent,
  getSiteConfigPersistent,
  saveSiteConfigPersistent,
  consumeRateLimit,
  StorageUnavailableError
} from '../lib/blobStore.js';
import { checkAdminRequest } from '../lib/adminAuth.js';

const MAX_BODY_BYTES = 100 * 1024; // 100 KB is far more than any accepted payload
const RATE_LIMITS = {
  bookings: { limit: 8, windowMs: 60 * 60 * 1000 },
  waitlist: { limit: 5, windowMs: 60 * 60 * 1000 }
};

/**
 * Same-origin CORS only.
 *
 * This used to send `Access-Control-Allow-Origin: *`, which let any website read
 * API responses (including admin-only ones) with a visitor's browser. The site
 * and this function share a host, so cross-origin callers are never legitimate.
 */
function corsHeaders(event) {
  const headers = event?.headers || {};
  const header = (name) => {
    const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
    return key ? String(headers[key] || '') : '';
  };
  const origin = header('origin');
  const host = header('host');
  const base = {
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    Vary: 'Origin'
  };
  if (origin && host) {
    try {
      if (new URL(origin).host === host) base['Access-Control-Allow-Origin'] = origin;
    } catch {
      // Malformed Origin header — send no CORS header at all.
    }
  }
  return base;
}

function createResponder(event) {
  const cors = corsHeaders(event);
  return function response(statusCode, body, extraHeaders = {}) {
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
        ...cors,
        ...extraHeaders
      },
      body: statusCode === 204 ? '' : JSON.stringify(body)
    };
  };
}

function getPath(rawPath = '') {
  let p = String(rawPath || '');
  if (/^https?:\/\//i.test(p)) {
    try { p = new URL(p).pathname; } catch { p = '/'; }
  }
  if (p.startsWith('/.netlify/functions/api')) {
    p = p.slice('/.netlify/functions/api'.length) || '/';
  }
  if (p.startsWith('/cappuccinostudiox')) {
    p = p.slice('/cappuccinostudiox'.length) || '/';
  }
  p = p.split('?')[0];
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p || '/';
}

function parseBody(event) {
  if (!event.body) return { ok: true, data: {} };
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  if (typeof raw !== 'string' || raw.length > MAX_BODY_BYTES) {
    return { ok: false, tooLarge: true, data: null };
  }
  try {
    const data = JSON.parse(raw);
    return { ok: true, data: data && typeof data === 'object' ? data : {} };
  } catch {
    return { ok: false, data: null };
  }
}

/** Honeypot: real visitors never fill a field they cannot see. */
function isBotSubmission(data) {
  if (!data || typeof data !== 'object') return false;
  const value = data.botField ?? data['bot-field'];
  return typeof value === 'string' && value.trim() !== '';
}

function clientIp(event) {
  const headers = event?.headers || {};
  const header = (name) => {
    const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
    return key ? String(headers[key] || '').split(',')[0].trim() : '';
  };
  return header('x-nf-client-connection-ip') || header('x-forwarded-for') || '';
}

export async function handler(event) {
  const respond = createResponder(event);
  const requireAdmin = () => {
    const auth = checkAdminRequest(event.headers || {});
    return auth.ok ? null : respond(auth.status, { error: auth.error });
  };
  const sendBookingResult = (result, successStatus = 200) => {
    if (!result.ok) return respond(result.status || 400, { error: result.error, code: result.code });
    return respond(successStatus, result);
  };
  const enforceRateLimit = async (action) => {
    const rule = RATE_LIMITS[action];
    const ip = clientIp(event);
    if (!rule || !ip) return null; // unattributable requests are not blocked
    const status = await consumeRateLimit(`${action}:${ip}`, rule.limit, rule.windowMs);
    if (status.ok) return null;
    const retryAfter = Math.max(1, Math.ceil((status.resetAt - Date.now()) / 1000));
    return respond(
      429,
      { error: 'Too many submissions from this network. Please try again later.', code: 'RATE_LIMITED' },
      { 'Retry-After': String(retryAfter) }
    );
  };

  try {
    const method = (event.httpMethod || 'GET').toUpperCase();
    const path = getPath(event.rawUrl || event.rawPath || event.path || '/');

    if (method === 'OPTIONS') return respond(204, {});

    if (path === '/api/local/projects') {
      if (method === 'GET') {
        const projects = await listProjectsPersistent();
        return respond(200, projects.map((p) => ({
          id: p.id,
          name: p.name,
          thumbnail: p.thumbnail || null,
          deckThumbnail: p.deckThumbnail || p.deck_thumbnail || null,
          discipline: (p.caseStudy && p.caseStudy.discipline) || p.discipline || null,
          layout: p.layout || 'deck'
        })));
      }
      if (method === 'POST') {
        // Write access requires the admin token — previously any visitor could
        // overwrite the whole portfolio.
        const denied = requireAdmin();
        if (denied) return denied;
        const body = parseBody(event);
        if (!body.ok) {
          return respond(body.tooLarge ? 413 : 400, {
            error: body.tooLarge ? 'Payload too large.' : 'Invalid JSON body.'
          });
        }
        const result = await saveProjectPersistent(body.data);
        if (!result.ok) return respond(result.status || 400, { error: result.error });
        return respond(200, { ok: true, project: result.project });
      }
      return respond(405, { error: 'Method not allowed' });
    }

    const projectMatch = path.match(/^\/api\/local\/projects\/([^/]+)$/);
    if (projectMatch) {
      if (method !== 'GET') return respond(405, { error: 'Method not allowed' });
      const id = decodeURIComponent(projectMatch[1]);
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return respond(400, { error: 'Invalid project id.' });
      const project = await getProjectPersistent(id);
      if (!project) return respond(404, { error: 'Project not found' });
      return respond(200, project);
    }

    if (path === '/api/project-files-config') {
      if (method === 'GET') {
        const cfg = await getSiteConfigPersistent();
        return respond(200, { config: cfg.project_files_3d || null });
      }
      if (method === 'POST') {
        // Write access requires the admin token.
        const denied = requireAdmin();
        if (denied) return denied;
        const body = parseBody(event);
        if (!body.ok) {
          return respond(body.tooLarge ? 413 : 400, {
            error: body.tooLarge ? 'Payload too large.' : 'Invalid JSON body.'
          });
        }
        const cfg = await getSiteConfigPersistent();
        const next = await saveSiteConfigPersistent({
          ...cfg,
          project_files_3d: body.data.config || body.data || null
        });
        return respond(200, { ok: true, config: next.project_files_3d || null });
      }
      return respond(405, { error: 'Method not allowed' });
    }

    if (path === '/api/availability') {
      if (method !== 'GET') return respond(405, { error: 'Method not allowed' });
      const bookings = await listBookingsPersistent();
      return respond(200, buildAvailability(bookings));
    }

    // Lightweight token probe for the admin UI: confirms the token without
    // returning booking PII.
    if (path === '/api/admin/session') {
      if (method !== 'GET') return respond(405, { error: 'Method not allowed' });
      const denied = requireAdmin();
      if (denied) return denied;
      return respond(200, { ok: true, admin: true });
    }

    if (path === '/api/bookings') {
      if (method === 'POST') {
        const body = parseBody(event);
        if (!body.ok) {
          return respond(body.tooLarge ? 413 : 400, {
            error: body.tooLarge ? 'Payload too large.' : 'Invalid JSON body.'
          });
        }
        if (isBotSubmission(body.data)) {
          // Honeypot tripped — answer like a success so bots learn nothing.
          return respond(200, { ok: true });
        }
        const limited = await enforceRateLimit('bookings');
        if (limited) return limited;
        const result = await createBookingPersistent(body.data);
        return sendBookingResult(result, 201);
      }
      if (method === 'GET') {
        const denied = requireAdmin();
        if (denied) return denied;
        const bookings = await listBookingsPersistent();
        return respond(200, { bookings, timezone: STUDIO_TIMEZONE });
      }
      return respond(405, { error: 'Method not allowed' });
    }

    const bookingMatch = path.match(/^\/api\/bookings\/([^/]+)$/);
    if (bookingMatch) {
      const denied = requireAdmin();
      if (denied) return denied;
      const id = decodeURIComponent(bookingMatch[1]);
      if (method === 'DELETE') {
        return sendBookingResult(await cancelBookingPersistent(id));
      }
      if (method === 'PATCH') {
        const body = parseBody(event);
        if (!body.ok) {
          return respond(body.tooLarge ? 413 : 400, {
            error: body.tooLarge ? 'Payload too large.' : 'Invalid JSON body.'
          });
        }
        return sendBookingResult(await rescheduleBookingPersistent(id, body.data));
      }
      return respond(405, { error: 'Method not allowed' });
    }

    if (path === '/api/waitlist') {
      if (method === 'POST') {
        const body = parseBody(event);
        if (!body.ok) {
          return respond(body.tooLarge ? 413 : 400, {
            error: body.tooLarge ? 'Payload too large.' : 'Invalid JSON body.'
          });
        }
        if (isBotSubmission(body.data)) return respond(200, { ok: true });
        const limited = await enforceRateLimit('waitlist');
        if (limited) return limited;
        const result = await joinWaitlistPersistent(body.data);
        if (!result.ok) return respond(result.status || 400, { error: result.error, code: result.code });
        return respond(result.duplicate ? 200 : 201, result);
      }
      if (method === 'GET') {
        const denied = requireAdmin();
        if (denied) return denied;
        return respond(200, { waitlist: await listWaitlistPersistent() });
      }
      return respond(405, { error: 'Method not allowed' });
    }

    if (path === '/api/upload') {
      if (method !== 'POST') return respond(405, { error: 'Method not allowed' });
      // Uploads stay off until a real, authenticated object store is configured.
      return respond(501, {
        error: 'Media uploads are not enabled on this deployment.',
        code: 'UPLOAD_DISABLED',
        nextStep: 'Configure object storage (for example Supabase Storage or S3) and set the upload environment variables.'
      });
    }

    return respond(404, { error: 'Not found' });
  } catch (err) {
    console.error('[api] unhandled error', err);
    if (err instanceof StorageUnavailableError) {
      return respond(503, { error: 'Booking storage is temporarily unavailable.', code: 'STORAGE_UNAVAILABLE' });
    }
    // Never echo internal error messages to the client.
    return respond(500, { error: 'Internal error' });
  }
}
