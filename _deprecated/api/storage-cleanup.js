/**
 * POST /api/storage-cleanup — remove orphan files from Supabase Storage (project-media).
 * Lists all objects in the bucket, fetches all projects, collects every URL referenced in
 * items[].src, items[].thumbnail, and assets[].src; deletes any object not in that set.
 * Requires SUPABASE_SERVICE_ROLE_KEY (list + delete). Call manually or via cron to keep Storage in sync.
 */
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'project-media';

function getSupabaseAdmin() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

export async function POST() {
    try {
        const supabase = getSupabaseAdmin();
        if (!supabase) {
            return new Response(JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY required for cleanup' }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        const inUsePaths = new Set();

        const { data: projects, error: projErr } = await supabase.from('projects').select('id, items, thumbnail, assets');
        if (projErr) {
            return new Response(JSON.stringify({ error: projErr.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        (projects || []).forEach(p => {
            const items = Array.isArray(p.items) ? p.items : [];
            items.forEach(it => {
                if (it && it.src && String(it.src).includes('/project-media/')) {
                    const m = it.src.match(/\/project-media\/(.+)$/);
                    if (m) inUsePaths.add(m[1].replace(/^\/+/, ''));
                }
                if (it && it.thumbnail && String(it.thumbnail).includes('/project-media/')) {
                    const m = it.thumbnail.match(/\/project-media\/(.+)$/);
                    if (m) inUsePaths.add(m[1].replace(/^\/+/, ''));
                }
            });
            const assets = Array.isArray(p.assets) ? p.assets : [];
            assets.forEach(a => {
                if (a && a.src && String(a.src).includes('/project-media/')) {
                    const m = a.src.match(/\/project-media\/(.+)$/);
                    if (m) inUsePaths.add(m[1].replace(/^\/+/, ''));
                }
            });
            if (p.thumbnail && String(p.thumbnail).includes('/project-media/')) {
                const m = p.thumbnail.match(/\/project-media\/(.+)$/);
                if (m) inUsePaths.add(m[1].replace(/^\/+/, ''));
            }
        });

        async function listAllPaths(prefix) {
            const { data, error } = await supabase.storage.from(BUCKET).list(prefix || '', { limit: 1000 });
            if (error) throw error;
            const paths = [];
            for (const f of data || []) {
                const path = prefix ? `${prefix}/${f.name}` : f.name;
                if (f.id != null) paths.push(path);
                else paths.push(...(await listAllPaths(path)));
            }
            return paths;
        }
        const allPaths = await listAllPaths('');
        const orphans = allPaths.filter(p => !inUsePaths.has(p));
        if (orphans.length === 0) {
            return new Response(JSON.stringify({ ok: true, deleted: 0, message: 'No orphan files' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        const { error: delErr } = await supabase.storage.from(BUCKET).remove(orphans);
        if (delErr) {
            return new Response(JSON.stringify({ error: delErr.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        return new Response(JSON.stringify({ ok: true, deleted: orphans.length, paths: orphans }), {
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
