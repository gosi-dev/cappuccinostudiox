# CMS data: where it’s stored and how to sync across devices

## How it works today

1. **Save (e.g. from project-edit):**
   - The app first tries **`POST /api/projects`** (send project to your backend).
   - If that **fails** (no server, 404, 500, network error), it **falls back** to **IndexedDB + localStorage** on **this device only**.

2. **Load (e.g. project page or project-edit):**
   - The app first tries **`GET /api/projects/:id`** (load project from your backend).
   - If that **fails**, it falls back to **IndexedDB**, then **localStorage** — again **only on this device**.

So:

- If the API is **never hit** or **always fails**, all data stays **in the browser** on the device where you saved it. Desktop and phone each have their own local data; they don’t see each other’s.
- If the API **succeeds**, data is read/written to your **database** (Supabase), and any device that can reach the API will see the same data.

## Why you might only see local data

- The site is opened as **static files** (e.g. `file://` or a host that doesn’t run your API). Then `/api/projects` doesn’t exist → every request fails → everything uses IndexedDB/localStorage.
- The app is **deployed** but the **API isn’t** (e.g. only HTML/JS/CSS, no serverless functions). Same result: no API → local only.
- **Supabase isn’t configured** on the deployment: `SUPABASE_URL` and `SUPABASE_ANON_KEY` are missing or wrong → API returns 500 → frontend falls back to local storage.
- **Supabase table missing or wrong**: e.g. no `projects` table or wrong columns → API fails → local only.

## How to make data accessible online (desktop + phone see the same data)

1. **Deploy the app so that the API runs**
   - Your repo has `api/projects.js` and `api/projects/[id].js` (e.g. Vercel-style serverless). Deploy to a host that runs these (e.g. **Vercel**, **Netlify Functions**) so that:
     - `POST /api/projects` and `GET /api/projects/:id` are served by that backend (not 404).

2. **Configure Supabase**
   - In the deployment (e.g. Vercel/Netlify env vars), set:
     - `SUPABASE_URL` = your Supabase project URL  
     - `SUPABASE_ANON_KEY` = your Supabase anon/public key  
   - So the API can connect to Supabase and read/write the same database from every device.

3. **Create the Supabase table**
   - In Supabase (SQL editor), create a table that matches what the API sends and expects, for example:

   ```sql
   create table if not exists projects (
     id text primary key,
     name text,
     items jsonb default '[]',
     storyline text default '',
     thumbnail text,
     assets jsonb default '[]'
   );
   ```

   - The API sends and returns: `id`, `name`, `items`, `storyline`, `thumbnail`, `assets`. So the table should have these columns (or equivalent JSON/JSONB) for data to persist correctly.

4. **Use the same URL on desktop and phone**
   - Open the **deployed** site URL (e.g. `https://your-app.vercel.app`) on both desktop and phone. Don’t use a local or `file://` URL. Then:
     - Saves go to the API → Supabase.
     - Loads come from the API → Supabase.
   - So both devices see the same data.

## Summary

| Situation | Where data lives | Same on desktop and phone? |
|----------|-------------------|----------------------------|
| API not deployed or not reachable | IndexedDB + localStorage (per device) | No |
| API deployed + Supabase configured + table exists | Supabase (cloud) | Yes, when both use the deployed site |

The frontend is already written to **prefer the API**; once the API is deployed, env vars are set, and the `projects` table exists in Supabase, data will be stored in the database and accessible online to all devices.
