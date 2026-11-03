import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../src/data');

async function readJsonFile(fileName, fallback) {
  const fullPath = path.join(DATA_DIR, fileName);
  try {
    const raw = await fs.readFile(fullPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function readProjects() {
  const projects = await readJsonFile('projects.json', []);
  return Array.isArray(projects) ? projects : [];
}

export async function readSiteConfig() {
  const cfg = await readJsonFile('site-config.json', {});
  return cfg && typeof cfg === 'object' ? cfg : {};
}

export async function readBookings() {
  const bookings = await readJsonFile('bookings.json', []);
  return Array.isArray(bookings) ? bookings : [];
}

export async function readWaitlist() {
  const waitlist = await readJsonFile('waitlist.json', []);
  return Array.isArray(waitlist) ? waitlist : [];
}

// Availability lives in the shared booking module so the local server and the
// Netlify Function always use identical timezone and slot rules.
export { buildAvailability } from './bookingShared.js';
