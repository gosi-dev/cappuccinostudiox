# How to run storage cleanup (keep only files in use)

Storage cleanup removes from Supabase bucket `project-media` any file that is **not** referenced by any project in your Supabase `projects` table. Follow these two steps.

**Stack: Supabase + Vercel + GitHub** — Get the values from Supabase, add them in Vercel, then run the cleanup (manually or via Vercel Cron).

---

## 1. Set the environment variables

The cleanup API needs **server-side** access to Supabase with list/delete rights. Use the **service role** key (not the anon key).

### Get the values from Supabase

**Data API vs API Keys**

- **Data API** (under Project Settings) — Shows your **Project URL** (the link to your project, e.g. `https://xxxxx.supabase.co`). That’s what you already use for `SUPABASE_URL` in Vercel. No keys there.
- **API Keys** (separate from Data API) — This is where the keys live. Go here for the **service_role** key. (The Project URL is usually on the Data API / API page; you only need the key from API Keys.)

**Where to find the service_role key**

1. Open the [Supabase Dashboard](https://supabase.com/dashboard) and select your project.
2. Left sidebar → **gear icon** (⚙️) **Project Settings** → **API Keys** (not “Data API”).
3. On the API Keys page you may see two **tabs**: e.g. **API Keys** (new format) and **Legacy API Keys**.
4. Open the **Legacy API Keys** tab. You’ll see:
   - **anon** — public key (you already have this as `SUPABASE_ANON_KEY`). Don’t use for cleanup.
   - **service_role** — secret key. Click **Reveal** (or the eye icon), then copy. This is the value for `SUPABASE_SERVICE_ROLE_KEY`. Use it only on the server; never expose it in the browser.

### Add the new variable in Vercel

You already have **SUPABASE_URL** and **SUPABASE_ANON_KEY** in Vercel. Keep those; the cleanup uses the same URL but needs the **service_role** key to list and delete storage files.

1. Open your project on [Vercel](https://vercel.com) → **Settings** → **Environment Variables**.
2. Add **one** new variable:
   - **Name:** `SUPABASE_SERVICE_ROLE_KEY`  
   - **Value:** the **service_role** key from Supabase (Settings → API / Data API → Project API keys → service_role → Reveal & copy).
3. Choose **Production** (and **Preview** if you want cleanup in preview). Save.
4. **Redeploy** (Deployments → … on latest → Redeploy) so the new variable is available.

---

## 2. Run the cleanup

You run cleanup by sending a **POST** request to your deployed site’s `/api/storage-cleanup` endpoint. Pick one way below.

**Your site URL** = your live Vercel URL, e.g. `https://your-project.vercel.app` or your custom domain. (Use the same URL you open in the browser to view the portfolio.)

---

### Option A: Run once manually

**Easiest — from the browser**

1. Open your **live site** in the browser (e.g. `https://your-project.vercel.app`).
2. Open DevTools: press **F12** (or right‑click → Inspect).
3. Go to the **Console** tab.
4. Paste this and press **Enter**:
   ```javascript
   fetch('/api/storage-cleanup', { method: 'POST' }).then(r => r.json()).then(console.log);
   ```
5. Check the result in the console:
   - `{ ok: true, deleted: 0, message: "No orphan files" }` — nothing to remove.
   - `{ ok: true, deleted: 5, paths: [...] }` — that many orphan files were deleted.

**From the terminal (curl)**

1. Open a terminal (PowerShell, Command Prompt, or Mac/Linux terminal).
2. Run (replace `YOUR_SITE_URL` with your real URL, e.g. `https://your-project.vercel.app`):
   ```bash
   curl -X POST https://YOUR_SITE_URL/api/storage-cleanup
   ```
3. The response will be JSON: `{"ok":true,"deleted":0,...}` or similar.

**If you see an error**

- **503** and message like `SUPABASE_SERVICE_ROLE_KEY required for cleanup` → the service role key is missing or not set in Vercel. Re-check step 1, then **Redeploy**.
- **404** → the route isn’t in your deployment. Make sure `api/storage-cleanup.js` exists in your repo, is committed and pushed to the branch Vercel deploys from, then trigger a **Redeploy** (Vercel → Deployments → … → Redeploy). After the new deployment finishes, try the request again.

---

### Option B: Run on a schedule (cron)

To run cleanup automatically (e.g. daily or weekly), use your host’s cron feature.

**Vercel Cron**

1. Create `vercel.json` in the project root (if it doesn’t exist).
2. Add a cron that triggers the cleanup route:

```json
{
  "crons": [
    {
      "path": "/api/storage-cleanup",
      "schedule": "0 3 * * *"
    }
  ]
}
```

`0 3 * * *` = every day at 3:00 AM UTC. Change as needed ([cron format](https://vercel.com/docs/cron-jobs)).

**Other hosts (Netlify, etc.)**

- Use the host’s “scheduled function” or “cron” (if available), and call `POST https://your-site.com/api/storage-cleanup`.
- Or use an external cron service (e.g. cron-job.org, GitHub Actions) to send a POST request to that URL on your desired schedule.

---

## Summary

1. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in your server environment.
2. Run cleanup manually with `POST /api/storage-cleanup` or set up a cron to call it regularly.

After that, Supabase will only keep files that are in use in your `projects` table; the rest are removed by the cleanup.
