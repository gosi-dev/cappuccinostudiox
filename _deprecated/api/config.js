/**
 * GET /api/config — public config for the frontend (e.g. Supabase for direct uploads).
 * Returns supabaseUrl and supabaseAnonKey so the client can upload media to Supabase Storage.
 */
export async function GET() {
    const url = process.env.SUPABASE_URL || '';
    const key = process.env.SUPABASE_ANON_KEY || '';
    return new Response(JSON.stringify({ supabaseUrl: url, supabaseAnonKey: key }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}
