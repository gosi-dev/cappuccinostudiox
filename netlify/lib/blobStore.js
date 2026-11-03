/**
 * Netlify Blobs persistence for bookings, slot locks and the waitlist.
 *
 * Bookings are stored as individual records (`bookings/<id>`) and each slot is
 * also written to a create-only lock (`slots/<date>/<HHMM>`). The lock makes
 * double-booking a single slot atomic across concurrent function invocations.
 */

import { createHash } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import {
  cancelBookingRecord,
  rescheduleBookingRecord,
  validateBookingInput,
  validateWaitlistInput,
  getBookingSlot
} from './bookingShared.js';
import {
  readBookings as readLegacyBookings,
  readProjects as readBundledProjects,
  readSiteConfig as readBundledSiteConfig
} from './jsonData.js';

const STORE_NAME = process.env.BOOKINGS_STORE_NAME || 'cappuccino-studio';
const BOOKINGS_PREFIX = 'bookings/';
const SLOTS_PREFIX = 'slots/';
const WAITLIST_PREFIX = 'waitlist/';

export class StorageUnavailableError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'StorageUnavailableError';
    this.cause = cause;
  }
}

function store() {
  return getStore({ name: STORE_NAME, consistency: 'strong' });
}

function slotKey(date, time) {
  return `${SLOTS_PREFIX}${date}/${String(time).replace(':', '')}`;
}

async function listKeys(prefix) {
  const blobs = [];
  for await (const page of store().list({ prefix, paginate: true })) {
    if (page && Array.isArray(page.blobs)) blobs.push(...page.blobs);
  }
  return blobs;
}

async function getJson(key) {
  return store().get(key, { type: 'json', consistency: 'strong' });
}

/** All booking records, newest first. Falls back to the bundled JSON on a fresh store. */
export async function listBookingsPersistent() {
  try {
    const blobs = await listKeys(BOOKINGS_PREFIX);
    if (blobs.length === 0) {
      const legacy = await readLegacyBookings();
      return Array.isArray(legacy) ? legacy : [];
    }
    const records = await Promise.all(
      blobs.map((blob) => getJson(blob.key).catch(() => null))
    );
    return records
      .filter((record) => record && typeof record === 'object')
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  } catch (err) {
    throw new StorageUnavailableError('Booking storage is unavailable.', err);
  }
}

/** Validate and persist a booking. Returns the shared validation result shape. */
export async function createBookingPersistent(input) {
  const existing = await listBookingsPersistent();
  const validation = validateBookingInput(input, existing);
  if (!validation.ok) return validation;

  const booking = validation.booking;
  const key = slotKey(booking.date, booking.time);
  let lockResult;
  try {
    lockResult = await store().setJSON(key, {
      bookingId: booking.id,
      date: booking.date,
      time: booking.time
    }, { onlyIfNew: true });
  } catch (err) {
    throw new StorageUnavailableError('Could not reserve that time slot.', err);
  }

  if (!lockResult || lockResult.modified === false) {
    return {
      ok: false,
      status: 409,
      error: 'That time has just been booked. Please choose another slot.',
      code: 'SLOT_TAKEN'
    };
  }

  try {
    await store().setJSON(`${BOOKINGS_PREFIX}${booking.id}`, booking);
    return { ok: true, booking };
  } catch (err) {
    // Do not leave a permanently reserved slot if the record write failed.
    await store().delete(key).catch(() => {});
    throw new StorageUnavailableError('Could not save that booking.', err);
  }
}

export async function cancelBookingPersistent(id) {
  const record = await getJson(`${BOOKINGS_PREFIX}${id}`).catch((err) => {
    throw new StorageUnavailableError('Could not load that booking.', err);
  });
  if (!record) return { ok: false, status: 404, error: 'Booking not found.', code: 'NOT_FOUND' };

  const result = cancelBookingRecord([record], id);
  if (!result.ok) return result;

  const slot = getBookingSlot(record);
  if (slot) {
    const key = slotKey(slot.date, slot.time);
    try {
      const lock = await getJson(key);
      if (lock && String(lock.bookingId) === String(record.id)) await store().delete(key);
    } catch {
      // The record update below is still the source of truth for availability.
    }
  }

  await store().setJSON(`${BOOKINGS_PREFIX}${record.id}`, result.booking);
  return result;
}

export async function rescheduleBookingPersistent(id, input) {
  const record = await getJson(`${BOOKINGS_PREFIX}${id}`).catch((err) => {
    throw new StorageUnavailableError('Could not load that booking.', err);
  });
  if (!record) return { ok: false, status: 404, error: 'Booking not found.', code: 'NOT_FOUND' };

  const existing = await listBookingsPersistent();
  const result = rescheduleBookingRecord(existing, id, input);
  if (!result.ok) return result;

  const oldSlot = getBookingSlot(record);
  const newSlot = getBookingSlot(result.booking);
  if (!newSlot) {
    return { ok: false, status: 400, error: 'Invalid new slot.', code: 'INVALID_DATETIME' };
  }
  if (oldSlot && oldSlot.date === newSlot.date && oldSlot.time === newSlot.time) {
    return { ok: true, booking: record, changed: false };
  }

  const newKey = slotKey(newSlot.date, newSlot.time);
  let lockResult;
  try {
    lockResult = await store().setJSON(newKey, {
      bookingId: record.id,
      date: newSlot.date,
      time: newSlot.time
    }, { onlyIfNew: true });
  } catch (err) {
    throw new StorageUnavailableError('Could not reserve the new time slot.', err);
  }
  if (!lockResult || lockResult.modified === false) {
    return {
      ok: false,
      status: 409,
      error: 'That time has just been booked. Please choose another slot.',
      code: 'SLOT_TAKEN'
    };
  }

  try {
    await store().setJSON(`${BOOKINGS_PREFIX}${record.id}`, result.booking);
  } catch (err) {
    await store().delete(newKey).catch(() => {});
    throw new StorageUnavailableError('Could not save the new time.', err);
  }

  if (oldSlot) {
    const oldKey = slotKey(oldSlot.date, oldSlot.time);
    await store().delete(oldKey).catch(() => {});
  }
  return result;
}

function waitlistKey(email) {
  const hash = createHash('sha256').update(String(email).toLowerCase()).digest('hex');
  return `${WAITLIST_PREFIX}${hash}`;
}

export async function joinWaitlistPersistent(input) {
  const validation = validateWaitlistInput(input);
  if (!validation.ok) return validation;

  const entry = validation.entry;
  const key = waitlistKey(entry.email);
  let result;
  try {
    result = await store().setJSON(key, entry, { onlyIfNew: true });
  } catch (err) {
    throw new StorageUnavailableError('Could not join the waitlist right now.', err);
  }
  if (!result || result.modified === false) {
    const existing = await getJson(key).catch(() => null);
    return { ok: true, duplicate: true, entry: existing || { email: entry.email } };
  }
  return { ok: true, duplicate: false, entry };
}

export async function listWaitlistPersistent() {
  const blobs = await listKeys(WAITLIST_PREFIX);
  const entries = await Promise.all(
    blobs.map((blob) => getJson(blob.key).catch(() => null))
  );
  return entries
    .filter(Boolean)
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

const PROJECTS_PREFIX = 'projects/';
const SITE_CONFIG_KEY = 'config/site';

/** Merge bundled projects with project records saved through the CMS. */
export async function listProjectsPersistent() {
  const bundled = await readBundledProjects();
  let saved = [];
  try {
    const blobs = await listKeys(PROJECTS_PREFIX);
    saved = (await Promise.all(
      blobs.map((blob) => getJson(blob.key).catch(() => null))
    )).filter(Boolean);
  } catch {
    saved = [];
  }
  const byId = new Map();
  for (const project of bundled) byId.set(String(project.id), project);
  for (const project of saved) byId.set(String(project.id), project);
  const bundledOrder = bundled.map((project) => String(project.id));
  const extra = saved
    .map((project) => String(project.id))
    .filter((id) => !bundledOrder.includes(id))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return [...bundledOrder, ...extra].map((id) => byId.get(id)).filter(Boolean);
}

export async function getProjectPersistent(id) {
  try {
    const saved = await getJson(`${PROJECTS_PREFIX}${id}`);
    if (saved) return saved;
  } catch {
    // Fall through to the bundled project.
  }
  const projects = await readBundledProjects();
  return projects.find((project) => String(project.id) === String(id)) || null;
}

/**
 * Fixed-window rate limiter backed by Netlify Blobs.
 *
 * Not perfectly atomic under concurrent invocations (two requests can both read
 * the same counter), but it turns a flood into a trickle, which is what a spam
 * guard needs. Buckets are keyed by a hash so raw IPs never land in storage.
 */
export async function consumeRateLimit(bucket, limit, windowMs) {
  const key = `ratelimit/${createHash('sha256').update(String(bucket)).digest('hex').slice(0, 32)}`;
  const now = Date.now();
  let record = null;
  try {
    record = await getJson(key);
  } catch {
    record = null;
  }
  if (!record || typeof record.resetAt !== 'number' || record.resetAt <= now) {
    record = { count: 0, resetAt: now + windowMs };
  }
  record.count += 1;
  try {
    await store().setJSON(key, record);
  } catch {
    // Storage problems must not lock real visitors out.
    return { ok: true, remaining: limit, resetAt: record.resetAt };
  }
  return {
    ok: record.count <= limit,
    remaining: Math.max(0, limit - record.count),
    resetAt: record.resetAt
  };
}

export async function saveProjectPersistent(project) {
  if (!project || typeof project !== 'object' || project.id == null || project.id === '') {
    return { ok: false, status: 400, error: 'Project id is required.' };
  }
  const id = String(project.id).trim();
  // Ids end up inside blob keys — keep them to a safe alphabet.
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) {
    return { ok: false, status: 400, error: 'Project id must be 1-40 letters, digits, - or _.' };
  }
  const name = String(project.name || ('Project ' + id)).slice(0, 200);
  const items = Array.isArray(project.items) ? project.items.slice(0, 400) : [];
  const assets = Array.isArray(project.assets) ? project.assets.slice(0, 400) : [];
  const record = {
    ...project,
    id,
    name,
    items,
    assets,
    updated_at: new Date().toISOString()
  };
  await store().setJSON(`${PROJECTS_PREFIX}${record.id}`, record);
  return { ok: true, project: record };
}

export async function getSiteConfigPersistent() {
  const bundled = await readBundledSiteConfig();
  try {
    const saved = await getJson(SITE_CONFIG_KEY);
    return saved && typeof saved === 'object' ? { ...bundled, ...saved } : bundled;
  } catch {
    return bundled;
  }
}

export async function saveSiteConfigPersistent(partial) {
  const current = await getSiteConfigPersistent();
  const next = { ...current, ...(partial && typeof partial === 'object' ? partial : {}) };
  await store().setJSON(SITE_CONFIG_KEY, next);
  return next;
}
