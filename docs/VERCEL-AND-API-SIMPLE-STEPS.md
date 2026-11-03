# Simple steps: Make your staging site save/load from the database

You’re using: **https://cappuccinostudiox-git-staging-ayomide-akindekos-projects.vercel.app**

---

## Step 1: Check that the API is running on staging

1. On your **desktop**, open a **new browser tab**.
2. Paste this link and press Enter (it tries to load “project 1” from the API):

   **https://cappuccinostudiox-git-staging-ayomide-akindekos-projects.vercel.app/api/projects/1**

3. See what happens:

   - **You see something like `{"id":"1","name":"...","items":[],...}` (or `{"error":"..."}`)**  
     → The API is running. Go to **Step 2**.

   - **You see “404” or “This page could not be found”**  
     → The API is not deployed for this staging URL. Go to **“If the API doesn’t run”** below.

   - **You see “500” or “Internal Server Error”**  
     → The API runs but something is wrong (often Supabase or table). Go to **Step 2** and **Step 3**.

---

## Step 2: Make sure Supabase is set for “Preview” (staging)

Supabase might be set only for Production. Staging uses **Preview**.

1. Go to **https://vercel.com** and log in.
2. Open your project (e.g. **Cappuccinostudiox**).
3. Go to **Settings** → **Environment Variables**.
4. Find **SUPABASE_URL** and **SUPABASE_ANON_KEY**.
5. For each one, check that **Preview** (or “Preview” environment) is **checked**.
6. If Preview was not checked, check it and **Save**. Then:
   - Go to **Deployments**, open the latest **staging** deployment, click **⋯** → **Redeploy** (so the new env vars are used).

---

## Step 3: Add the `assets` column in Supabase (if the table is old)

If the `projects` table was created before we added “assets”, the API can fail when saving.

1. Go to **https://supabase.com** and open your project.
2. In the left menu, click **SQL Editor**.
3. Click **New query**.
4. Paste this and run it (Run / Execute):

   ```sql
   alter table projects
   add column if not exists assets jsonb default '[]';
   ```

5. If it says “success” or no error, you’re done. If it says the column already exists, that’s fine too.

---

## Step 4: Test “desktop → phone”

1. On **desktop**: open your **staging** site and go to the **project edit** page for project 1 (or create/edit a project and add some content).
2. Click **Save project** and wait until you see “Saved”.
3. On your **phone**: open the **same** staging URL in the browser, e.g.  
   **https://cappuccinostudiox-git-staging-ayomide-akindekos-projects.vercel.app/project-files.html**  
   then open project 1, or go directly to  
   **https://cappuccinostudiox-git-staging-ayomide-akindekos-projects.vercel.app/project.html?id=1**
4. If the same content appears on the phone, data is now coming from the database.

---

## If the API doesn’t run (Step 1 shows 404)

Then Vercel is not running your `api` folder for this deployment. Often:

- The **branch** that’s deployed (e.g. `staging`) doesn’t have the `api` folder, or
- The project is set up as “static only”.

What to do:

1. In your repo, make sure the **staging** branch has an **api** folder at the root with:
   - **api/projects.js**
   - **api/projects/[id].js**
2. Push to **staging** and wait for Vercel to redeploy.
3. Try the link from Step 1 again.

If you use a template or “Import” from Vercel, make sure the project type supports **Serverless Functions** (the `api` folder is a common way for that).

---

## Quick recap

| Step | What you do |
|------|------------------|
| 1 | Open `/api/projects/1` in the browser; see if you get JSON or an error. |
| 2 | In Vercel → Settings → Environment Variables, enable **Preview** for Supabase vars and redeploy if needed. |
| 3 | In Supabase → SQL Editor, run `alter table projects add column if not exists assets jsonb default '[]';` |
| 4 | Save on desktop, open same URL on phone; content should match. |

If something doesn’t work, note exactly what you see at Step 1 (e.g. 404, 500, or the JSON text) and what happens when you save on desktop and open on phone; that will narrow down the problem.
