import { createClient } from '@supabase/supabase-js';

function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    return createClient(url, key);
}

/**
 * GET /api/projects/:id — fetch one project by id from Supabase.
 */
export async function GET(request) {
    const url = new URL(request.url);
    const pathParts = url.pathname.replace(/\/$/, '').split('/');
    const id = pathParts[pathParts.length - 1];
    if (!id) {
        return new Response(JSON.stringify({ error: 'Project id required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('projects')
            .select('id, name, items, storyline, storyline_title, thumbnail, assets, default_background_url')
            .eq('id', id)
            .maybeSingle();
        if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        if (!data) {
            return new Response(JSON.stringify({
                id: id,
                name: `Project ${id}`,
                items: [],
                storyline: '',
                storylineTitle: '',
                thumbnail: null,
                assets: [],
                defaultBackgroundUrl: null
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache, must-revalidate' }
            });
        }
        return new Response(JSON.stringify({
            id: data.id,
            name: data.name ?? `Project ${data.id}`,
            items: Array.isArray(data.items) ? data.items : [],
            storyline: data.storyline ?? '',
            storylineTitle: data.storyline_title ?? data.storylineTitle ?? '',
            thumbnail: data.thumbnail ?? null,
            assets: Array.isArray(data.assets) ? data.assets : [],
            defaultBackgroundUrl: data.default_background_url ?? null
        }), {
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
