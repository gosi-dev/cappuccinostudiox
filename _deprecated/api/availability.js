import { createClient } from '@supabase/supabase-js';

function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    return createClient(url, key);
}

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const SLOTS = ['11:00', '15:00'];

function formatDateLabel(dateStr) {
    const d = new Date(dateStr + 'T12:00:00.000Z');
    return DAY_NAMES[d.getUTCDay()] + ', ' + d.getUTCDate() + ' ' + MONTH_NAMES[d.getUTCMonth()];
}

/** Next weekday after today (UTC). No same-day; no Sat/Sun. */
function nextWeekdayFromToday() {
    const today = new Date();
    const y = today.getUTCFullYear();
    const m = today.getUTCMonth();
    const d = today.getUTCDate();
    let next = new Date(Date.UTC(y, m, d + 1));
    while (next.getUTCDay() === 0 || next.getUTCDay() === 6) {
        next.setUTCDate(next.getUTCDate() + 1);
    }
    return next;
}

function toDateStr(d) {
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}

/** Get next 15 weekdays starting from the day after today (no Sat/Sun). */
function getNext15Weekdays() {
    const list = [];
    let d = nextWeekdayFromToday();
    while (list.length < 15) {
        list.push(toDateStr(d));
        d.setUTCDate(d.getUTCDate() + 1);
        while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
            d.setUTCDate(d.getUTCDate() + 1);
        }
    }
    return list;
}

/** Extract "11:00" or "15:00" from ISO datetime string (UTC). */
function slotFromDatetime(iso) {
    const d = new Date(iso);
    const h = d.getUTCHours();
    const m = d.getUTCMinutes();
    if (h === 11 && m === 0) return '11:00';
    if (h === 15 && m === 0) return '15:00';
    return null;
}

/**
 * GET /api/availability
 * Returns next 15 available days (weekdays only, not today). For each day, only 11:00 and 15:00 that are not booked.
 * Response: { dates: [ { date, label, times: ['11:00'] | ['15:00'] | ['11:00','15:00'] }, ... ] }
 */
export async function GET() {
    try {
        const weekdays = getNext15Weekdays();
        if (weekdays.length === 0) {
            return new Response(JSON.stringify({ dates: [] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        const first = weekdays[0] + 'T00:00:00.000Z';
        const last = weekdays[weekdays.length - 1];
        const lastDate = new Date(last + 'T12:00:00.000Z');
        lastDate.setUTCDate(lastDate.getUTCDate() + 1);
        const lastEnd = lastDate.getUTCFullYear() + '-' + String(lastDate.getUTCMonth() + 1).padStart(2, '0') + '-' + String(lastDate.getUTCDate()).padStart(2, '0') + 'T00:00:00.000Z';

        const supabase = getSupabase();
        const { data: rows, error } = await supabase
            .from('bookings')
            .select('datetime')
            .gte('datetime', first)
            .lt('datetime', lastEnd);

        if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const bookedByDate = {};
        weekdays.forEach(function (d) { bookedByDate[d] = new Set(); });
        (rows || []).forEach(function (r) {
            const slot = slotFromDatetime(r.datetime);
            if (!slot) return;
            const dateStr = r.datetime.slice(0, 10);
            if (bookedByDate[dateStr]) bookedByDate[dateStr].add(slot);
        });

        const dates = [];
        weekdays.forEach(function (dateStr) {
            const taken = bookedByDate[dateStr] || new Set();
            const times = SLOTS.filter(function (t) { return !taken.has(t); });
            if (times.length === 0) return;
            dates.push({
                date: dateStr,
                label: formatDateLabel(dateStr),
                times: times
            });
        });

        return new Response(JSON.stringify({ dates: dates }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: String(e.message) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
