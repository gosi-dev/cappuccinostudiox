# Supabase Storage setup for project media

## Why you see “can’t store files over 4.5 MB” / “Saved locally only”

When you **Save**, the app sends the whole project (including all media) in one request. **Vercel has a 4.5 MB request body limit** that cannot be changed. If your project JSON is bigger than that (e.g. lots of images or video stored as base64 inside the JSON), the cloud save fails and you get:

- **“Project too large to sync (over 4.5 MB). Save works on this device only.”**
- Or an alert saying your project is over 4.5 MB and to **set up Supabase Storage**.

**Fix:** Set up Supabase Storage as below. Then **new** images and videos are uploaded to Storage and only **URLs** are saved in the project, so the JSON stays small and Save syncs to the cloud. If a project already has a lot of embedded media, consider re-adding that media after setup (so it uploads to Storage) or removing some content and saving again.

---

So that project media (images, videos, thumbnails) are stored in Supabase instead of in the project JSON, the app uploads files to a **Supabase Storage** bucket and saves only URLs in the database. That keeps the payload under the 4.5 MB API limit and lets projects sync across devices.

## 1. Create the bucket

1. In **Supabase** go to **Storage** in the left sidebar.
2. Click **New bucket**.
3. Name: **project-media** (must match the app).
4. Turn **Public bucket** **ON** so the project page can load images/videos by URL.
5. Click **Create bucket**.

## 2. Allow uploads (RLS policies)

The frontend uses the **anon** key to upload. You need **two** policies on `storage.objects`: one for **upload (insert)** and one for **read (select)**.

**In the UI (Policies):** Create two policies. For the first choose **Allowed operation: INSERT** and **Target roles: public** (or **anon**), with check `bucket_id = 'project-media'`. For the second choose **Allowed operation: SELECT** and **Target roles: public** (or **anon**), with using `bucket_id = 'project-media'`. If you already have one policy with `bucket_id = 'project-media'`, add the other for the missing operation (you need both INSERT and SELECT); you are not replacing the existing code.

**Or run in SQL Editor:**

**Option A – Policy for “Anyone can upload and read” (simple for a portfolio):**

```sql
-- Allow anyone to upload (insert) into project-media
create policy "Allow public uploads"
on storage.objects for insert
to public
with check (bucket_id = 'project-media');

-- Allow anyone to read from project-media (public bucket)
create policy "Allow public read"
on storage.objects for select
to public
using (bucket_id = 'project-media');
```

**Option B – If your project already has storage policies**, add one that allows `insert` and `select` for bucket `project-media` for the role(s) you use (e.g. `anon` or `public`).

## 3. Environment variables

The app needs Supabase URL and anon key for the **API** (already used for the `projects` table) and for the **frontend** (so it can upload to Storage).

- **Vercel**: In your project → **Settings** → **Environment Variables**, set:
  - `SUPABASE_URL` = your Supabase project URL  
  - `SUPABASE_ANON_KEY` = your Supabase anon (public) key  
  and enable these for **Preview** and **Production** so both staging and production can upload.

The frontend gets these via **GET /api/config**, which your API serves from the same env vars. No extra env vars are needed for Storage.

## 4. Flow after setup

- **Add image**: file is uploaded to `project-media/{projectId}/{unique}-filename`, item gets the public URL.
- **Add video (trimmed)**: trimmed WebM is uploaded to Storage, item gets the public URL.
- **Thumbnail**: image is uploaded to Storage, project thumbnail is stored as URL.
- **Replace / Re-trim / Add cut**: same idea – new file/blob is uploaded, item or asset gets the new URL.

The **projects** table only stores URLs and metadata, so the JSON stays small and syncs correctly.

**File size:** Supabase **Free** tier allows up to **50 MB** per file (set in [Storage Settings](https://supabase.com/dashboard/project/_/storage/settings)). The app blocks uploads over 50 MB and shows “File too large (max 50 MB). Use a smaller file or compress it.” On **Pro/Team** you can raise the global limit (up to 500 GB) in the same settings.

## 5. If uploads fail or save still says “over 4.5 MB”

- **Vercel env vars:** `SUPABASE_URL` and `SUPABASE_ANON_KEY` must be set (and enabled for Preview + Production). The frontend gets them from **GET /api/config**; if those are missing, uploads never go to Storage and media stays in the JSON.
- **Bucket:** Name must be exactly **project-media**, and the bucket must be **Public**.
- **Policies:** Both INSERT and SELECT policies for `storage.objects` and `bucket_id = 'project-media'` (see step 2).
- **Redeploy:** After changing env vars on Vercel, trigger a new deployment so the API and /api/config use the latest values.
- Check the two policies above (or equivalent) exist for `storage.objects` and bucket `project-media`.
- In the browser console you may see “Supabase upload error” with the exact error from Supabase.
