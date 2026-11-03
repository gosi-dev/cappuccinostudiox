import { createClient } from '@supabase/supabase-js';

function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    return createClient(url, key);
}

/**
 * POST /api/bookings — create a booking.
 * Body: { service, datetime, name, email, phone? }
 */
export async function POST(request) {
    if (request.headers.get('Content-Type')?.toLowerCase().includes('application/json') !== true) {
        return new Response(JSON.stringify({ error: 'Content-Type: application/json required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    let body;
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    const service = body.service != null ? String(body.service) : '';
    let datetime = body.datetime != null ? String(body.datetime).trim() : null;
    if (datetime) {
        const d = new Date(datetime);
        if (!Number.isNaN(d.getTime())) datetime = d.toISOString();
        else datetime = null;
    }
    if (!datetime) {
        return new Response(JSON.stringify({ error: 'Valid date and time required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    const name = body.name != null ? String(body.name) : '';
    const email = body.email != null ? String(body.email) : '';
    const phone = body.phone != null ? String(body.phone).trim() || null : null;
    if (!name.trim() || !email.trim()) {
        return new Response(JSON.stringify({ error: 'Name and email required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    if (!service.trim()) {
        return new Response(JSON.stringify({ error: 'Service required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    const row = {
        service: service || null,
        datetime: datetime || null,
        name: name.trim(),
        email: email.trim(),
        status: 'pending'
    };
    if (phone !== null) row.phone = phone;
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase.from('bookings').insert(row).select('id').single();
        if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        return new Response(JSON.stringify({ ok: true, id: data?.id }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: String(e.message) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
