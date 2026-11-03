import { createClient } from '@supabase/supabase-js';

const CONFIG_KEY = 'project_files_3d';

function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    return createClient(url, key);
}

/**
 * GET /api/project-files-config — fetch Project Files 3D config from Supabase.
 * Returns { config } or { config: null } if no row. Frontend falls back to localStorage then defaults.
 */
export async function GET() {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('site_config')
            .select('value')
            .eq('key', CONFIG_KEY)
            .maybeSingle();
        if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        const config = data?.value ?? null;
        return new Response(JSON.stringify({ config }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache, must-revalidate' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: String(e.message) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

/**
 * POST /api/project-files-config — save Project Files 3D config to Supabase.
 * Body: full config object (width, height, isoCardCount, etc.).
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
    if (!body || typeof body !== 'object') {
        return new Response(JSON.stringify({ error: 'Body must be a JSON object' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    try {
        const supabase = getSupabase();
        const { error } = await supabase
            .from('site_config')
            .upsert({ key: CONFIG_KEY, value: body }, { onConflict: 'key' });
        if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        return new Response(JSON.stringify({ ok: true }), {
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
