/**
 * Shared booking domain logic.
 *
 * Used by both the local Express server and the Netlify Function. It owns:
 * timezone/opening-hours rules, availability, validation, and booking changes.
 * Date keys are YYYY-MM-DD in the studio timezone; `datetime` stays UTC ISO.
 */

export const STUDIO_TIMEZONE = process.env.STUDIO_TIMEZONE || 'Europe/London';
export const BOOKING_DURATION_MINUTES = 60;
export const AVAILABILITY_DAYS = 15;
export const SLOT_TIMES = [
  '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00'
];

/**
 * Every slug a booking form can submit. Keep this in sync with the
 * `data-value` attributes of the service dropdowns in booking.html,
 * index.html, kitchen.html, project-files.html and offers.html — a slug that
 * is not listed here is rejected with INVALID_SERVICE, which silently breaks
 * the offer CTAs on offers.html.
 *
 * The three fixed-price offers (offers.html) and the two service-only entries
 * added with them are part of the public funnel and must stay here.
 */
export const SERVICE_SLUGS = [
  'animation-production',
  'brand-strategy',
  'content-design-and-dev',
  'content-engine',
  'creative-direction',
  'creative-strategist',
  'edit-sprint',
  'immersive-experiences',
  'marketing-consult',
  'music-production',
  'music-release-content-dev',
  'product-development',
  'real-estate-management',
  'set-design',
  'sound-design-and-production',
  'video-production',
  'web-development'
];

const SERVICE_LABELS = {
  'animation-production': 'Animation Production',
  'brand-strategy': 'Brand Strategy',
  'content-design-and-dev': 'Content Design and Dev',
  'content-engine': 'Content Engine',
  'creative-direction': 'Creative Direction',
  'creative-strategist': 'Creative Strategist',
  'edit-sprint': 'Edit Sprint',
  'immersive-experiences': 'Immersive Experiences',
  'marketing-consult': 'Marketing Consult',
  'music-production': 'Music Production',
  'music-release-content-dev': 'Music Release Content Dev',
  'product-development': 'Product Development',
  'real-estate-management': 'Real Estate Management',
  'set-design': 'Set Design',
  'sound-design-and-production': 'Sound Design and Production',
  'video-production': 'Video Production',
  'web-development': 'Web Development'
};

function pad2(n) {
  return String(n).padStart(2, '0');
}

function normalizeEmail(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

/** Basic, deliberately conservative email check. */
export function isValidEmail(value) {
  const email = String(value == null ? '' : value).trim();
  if (!email || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/** Convert a Date to calendar parts in an IANA timezone. */
export function getPartsInTimeZone(date, timeZone = STUDIO_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  let hour = Number(parts.hour);
  // Some engines emit "24" for midnight when hour12 is false.
  if (hour === 24) hour = 0;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

/** Today's date key in the studio timezone. */
export function getTodayKey(now = new Date(), timeZone = STUDIO_TIMEZONE) {
  const p = getPartsInTimeZone(now, timeZone);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** Strictly parse YYYY-MM-DD and return the UTC-noon Date used for labels only. */
function parseDateKey(dateKey) {
  if (typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return date;
}

export function isDateKey(dateKey) {
  return parseDateKey(dateKey) !== null;
}

export function addDays(dateKey, days) {
  const date = parseDateKey(dateKey);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + Number(days));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

export function isWeekend(dateKey) {
  const date = parseDateKey(dateKey);
  if (!date) return false;
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/** Human label, always e.g. "MON, 20 OCT" regardless of browser locale. */
export function formatDateLabel(dateKey) {
  const date = parseDateKey(dateKey);
  if (!date) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  return `${String(parts.weekday || '').toUpperCase()}, ${parts.day} ${String(parts.month || '').toUpperCase()}`;
}

/** Offset of `timeZone` at a given instant, in milliseconds. */
function getTimeZoneOffsetMs(date, timeZone) {
  const p = getPartsInTimeZone(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

/** Convert a wall-clock date/time in the studio timezone to a UTC Date. */
export function zonedTimeToUtc(dateKey, time, timeZone = STUDIO_TIMEZONE) {
  const date = parseDateKey(dateKey);
  if (!date || !/^\d{2}:\d{2}$/.test(String(time || ''))) return null;
  const [hour, minute] = String(time).split(':').map(Number);
  if (hour > 23 || minute > 59) return null;
  const utcGuess = Date.UTC(
    date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute, 0
  );
  let offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  let result = utcGuess - offset;
  const offsetAtResult = getTimeZoneOffsetMs(new Date(result), timeZone);
  if (offsetAtResult !== offset) result = utcGuess - offsetAtResult;
  return new Date(result);
}

/** Read a booking's date/time, including legacy `datetime` records. */
export function getBookingSlot(booking) {
  if (!booking) return null;
  if (typeof booking.date === 'string' && typeof booking.time === 'string') {
    return { date: booking.date, time: booking.time };
  }
  if (typeof booking.datetime === 'string') {
    const match = booking.datetime.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    if (match) return { date: match[1], time: match[2] };
  }
  return null;
}

function bookedSlots(bookings) {
  const map = new Map();
  for (const booking of Array.isArray(bookings) ? bookings : []) {
    if (!booking || booking.status === 'cancelled') continue;
    const slot = getBookingSlot(booking);
    if (!slot) continue;
    if (!map.has(slot.date)) map.set(slot.date, new Set());
    map.get(slot.date).add(slot.time);
  }
  return map;
}

/**
 * Build the next N weekday availability entries.
 * Every weekday is returned, even when fully booked, so the UI can explain it.
 */
export function buildAvailability(bookings = [], options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const timeZone = options.timeZone || STUDIO_TIMEZONE;
  const days = Number.isFinite(options.days) ? options.days : AVAILABILITY_DAYS;
  const booked = bookedSlots(bookings);
  let cursor = addDays(getTodayKey(now, timeZone), 1);
  const dates = [];

  while (dates.length < days) {
    if (!isWeekend(cursor)) {
      const dateBooked = booked.get(cursor) || new Set();
      dates.push({
        date: cursor,
        label: formatDateLabel(cursor),
        times: SLOT_TIMES.filter((time) => !dateBooked.has(time))
      });
    }
    cursor = addDays(cursor, 1);
  }

  return {
    dates,
    timezone: timeZone,
    durationMinutes: BOOKING_DURATION_MINUTES,
    slotTimes: SLOT_TIMES
  };
}

function makeReference(existingBookings = []) {
  const used = new Set(
    (Array.isArray(existingBookings) ? existingBookings : [])
      .map((booking) => booking && booking.reference)
      .filter(Boolean)
  );
  for (let attempt = 0; attempt < 20; attempt++) {
    const bytes = new Uint8Array(3);
    if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
      globalThis.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    const reference = 'CS-' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    if (!used.has(reference)) return reference;
  }
  return 'CS-' + Date.now().toString(36).toUpperCase().slice(-6);
}

function makeId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `booking-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function fail(status, error, code) {
  return { ok: false, status, error, code };
}

/**
 * Validate a booking request and build the record that should be persisted.
 * @returns {{ok:true, booking:object}|{ok:false,status:number,error:string,code:string}}
 */
export function validateBookingInput(input, bookings = [], options = {}) {
  if (!input || typeof input !== 'object') {
    return fail(400, 'Please complete the booking form.', 'INVALID_BODY');
  }

  const name = String(input.name == null ? '' : input.name).trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name)) {
    return fail(400, 'Please enter your full name (2–120 characters).', 'INVALID_NAME');
  }

  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    return fail(400, 'Please enter a valid email address.', 'INVALID_EMAIL');
  }

  const service = String(input.service == null ? '' : input.service).trim().toLowerCase();
  if (!SERVICE_SLUGS.includes(service)) {
    return fail(400, 'Please choose a service.', 'INVALID_SERVICE');
  }

  let date = String(input.date == null ? '' : input.date).trim();
  let time = String(input.time == null ? '' : input.time).trim();
  if ((!date || !time) && typeof input.datetime === 'string') {
    const match = input.datetime.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    if (match) {
      date = date || match[1];
      time = time || match[2];
    }
  }

  if (!isDateKey(date)) {
    return fail(400, 'Please choose a valid date.', 'INVALID_DATE');
  }
  if (!/^\d{2}:\d{2}$/.test(time)) {
    return fail(400, 'Please choose a valid time.', 'INVALID_TIME');
  }

  const availability = buildAvailability(bookings, options);
  const day = availability.dates.find((entry) => entry.date === date);
  if (!day) {
    return fail(400, 'That date is not available. Please choose one of the next available weekdays.', 'DATE_UNAVAILABLE');
  }
  if (!SLOT_TIMES.includes(time)) {
    return fail(400, 'Please choose a valid session time.', 'INVALID_TIME');
  }
  if (!day.times.includes(time)) {
    return fail(409, 'That time has just been booked. Please choose another slot.', 'SLOT_TAKEN');
  }

  const timeZone = options.timeZone || STUDIO_TIMEZONE;
  const start = zonedTimeToUtc(date, time, timeZone);
  if (!start) {
    return fail(400, 'Please choose a valid date and time.', 'INVALID_DATETIME');
  }
  if (start.getTime() <= Date.now()) {
    return fail(400, 'That session time has already passed. Please choose another slot.', 'SLOT_PAST');
  }
  const end = new Date(start.getTime() + BOOKING_DURATION_MINUTES * 60 * 1000);
  const now = new Date();

  return {
    ok: true,
    booking: {
      id: makeId(),
      reference: makeReference(bookings),
      name,
      email,
      service,
      serviceLabel: SERVICE_LABELS[service] || service,
      date,
      time,
      timezone: timeZone,
      durationMinutes: BOOKING_DURATION_MINUTES,
      datetime: start.toISOString(),
      startUtc: start.toISOString(),
      endUtc: end.toISOString(),
      status: 'confirmed',
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    }
  };
}

export function cancelBookingRecord(bookings, id, options = {}) {
  const list = Array.isArray(bookings) ? bookings : [];
  const index = list.findIndex((booking) => booking && String(booking.id) === String(id));
  if (index < 0) return fail(404, 'Booking not found.', 'NOT_FOUND');
  const current = list[index];
  if (current.status === 'cancelled') {
    return { ok: true, booking: current, changed: false };
  }
  const now = options.now instanceof Date ? options.now : new Date();
  const updated = {
    ...current,
    status: 'cancelled',
    cancelled_at: now.toISOString(),
    updated_at: now.toISOString()
  };
  list[index] = updated;
  return { ok: true, booking: updated, changed: true };
}

export function rescheduleBookingRecord(bookings, id, input, options = {}) {
  const list = Array.isArray(bookings) ? bookings : [];
  const index = list.findIndex((booking) => booking && String(booking.id) === String(id));
  if (index < 0) return fail(404, 'Booking not found.', 'NOT_FOUND');
  const current = list[index];
  if (current.status === 'cancelled') {
    return fail(409, 'Cancelled bookings cannot be rescheduled.', 'BOOKING_CANCELLED');
  }

  const otherBookings = list.filter((_, i) => i !== index);
  const validation = validateBookingInput({
    name: current.name,
    email: current.email,
    service: current.service,
    date: input && input.date,
    time: input && input.time
  }, otherBookings, options);
  if (!validation.ok) return validation;

  const now = options.now instanceof Date ? options.now : new Date();
  const updated = {
    ...current,
    ...validation.booking,
    id: current.id,
    reference: current.reference || validation.booking.reference,
    created_at: current.created_at || validation.booking.created_at,
    rescheduled_at: now.toISOString(),
    updated_at: now.toISOString()
  };
  list[index] = updated;
  return { ok: true, booking: updated, changed: true };
}

export function validateWaitlistInput(input) {
  if (!input || typeof input !== 'object') {
    return fail(400, 'Please complete the waitlist form.', 'INVALID_BODY');
  }
  const name = String(input.name == null ? '' : input.name).trim().replace(/\s+/g, ' ');
  if (name.length > 120 || /[\u0000-\u001f\u007f]/.test(name)) {
    return fail(400, 'Please enter a valid name.', 'INVALID_NAME');
  }
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    return fail(400, 'Please enter a valid email address.', 'INVALID_EMAIL');
  }
  const tier = String(input.tier == null || input.tier === '' ? 'regular' : input.tier).trim().toLowerCase();
  if (tier !== 'regular') {
    return fail(400, 'Priority access is not available yet.', 'TIER_UNAVAILABLE');
  }
  return {
    ok: true,
    entry: {
      id: makeId(),
      name,
      email,
      tier: 'regular',
      created_at: new Date().toISOString()
    }
  };
}

export function serviceLabel(slug) {
  return SERVICE_LABELS[slug] || slug;
}

export function isServiceSlug(slug) {
  return SERVICE_SLUGS.includes(String(slug || '').toLowerCase());
}

