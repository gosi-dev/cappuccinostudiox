import { createClient } from '@supabase/supabase-js';

function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    return createClient(url, key);
}

/**
 * POST /api/waitlist — join waitlist.
 * Body: { name?, email, tier? }  tier: 'regular' | 'priority'
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
    const email = body.email != null ? String(body.email).trim() : '';
    const name = body.name != null ? String(body.name).trim() || null : null;
    const tier = body.tier != null ? String(body.tier).trim() || null : null;

    if (!email) {
        return new Response(JSON.stringify({ error: 'Email required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const row = {
        email,
        name,
        tier: tier || null,
        product: tier || null
    };

    try {
        const supabase = getSupabase();
        const { data, error } = await supabase.from('waitlist').insert(row).select('id').single();
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
