/**
 * Minimal shared-secret auth for booking admin endpoints.
 *
 * Set ADMIN_TOKEN in Netlify (and locally if you want to test the admin UI).
 * Admin requests send `Authorization: Bearer <token>` or `X-Admin-Token`.
 */

import { timingSafeEqual } from 'node:crypto';

export function getAdminToken() {
  return process.env.ADMIN_TOKEN || process.env.BOOKINGS_ADMIN_TOKEN || '';
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function getRequestToken(headers = {}) {
  const auth = headers.authorization || headers.Authorization || '';
  if (typeof auth === 'string' && /^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '').trim();
  return String(headers['x-admin-token'] || headers['X-Admin-Token'] || '').trim();
}

export function checkAdminRequest(headers = {}, options = {}) {
  const expected = getAdminToken();
  if (!expected) {
    if (options.allowUnconfigured) return { ok: true };
    return {
      ok: false,
      status: 503,
      error: 'Booking admin is not configured. Set ADMIN_TOKEN in the site environment.'
    };
  }
  const supplied = getRequestToken(headers);
  if (!supplied || !safeEqual(supplied, expected)) {
    return { ok: false, status: 401, error: 'Admin authorisation required.' };
  }
  return { ok: true };
}
