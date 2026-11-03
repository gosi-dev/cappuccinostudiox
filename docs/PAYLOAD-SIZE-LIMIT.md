# Why your project doesn’t sync to the cloud (4.5 MB limit)

## What’s going on

- When you **Save** on the project edit page, the app sends the **whole project** (including all base64 images and videos) to the API in one request.
- **Vercel** (where the API runs) has a **4.5 MB request body limit** that **cannot be increased**. If your project JSON is bigger than that, the request fails with **413 Payload Too Large**.
- When that happens, the app **still saves your project on this device** (IndexedDB + localStorage) and shows: **“Saved locally only”** and an alert that cloud sync failed.
- The **project view** page always loads from the **API first**. If the API has no project (or an empty one), you see **dummy/placeholder content**. So:
  - **On this PC:** You see your real content only from **local** data when you’re on the **edit** page; if you open the **project view** page, it may still load empty from the API and show dummy content.
  - **On your phone:** There is no local data, so you only ever see what the API returns (empty → dummy content).

So: **nothing updates on your phone**, and **project view can show dummy content**, because the **full project never reaches the database** when it’s over 4.5 MB.

## What you can do now

1. **Keep projects under 4.5 MB**  
   Fewer/smaller images and shorter (or fewer) trimmed videos so the saved JSON stays under 4.5 MB. Then Save will sync to the cloud and the project will load on all devices.

2. **Use “Saved locally only” as the signal**  
   If you see **“Saved locally only”** or the alert about cloud sync failing, the project was **not** written to the database. Remove some media or shorten clips and save again.

## Proper fix (for later): store media in Supabase Storage

To support large projects and sync to the cloud:

- **Upload images and videos** to **Supabase Storage** (or similar) and get back **URLs**.
- Store only those **URLs** (and trim points, names, etc.) in the `projects` table, not the base64 data.
- The request body stays small (well under 4.5 MB), so the API can save and load the project on all devices; the browser then loads images/videos from the storage URLs.

That requires changes to the edit page (upload to Storage, then save project with URLs) and possibly to the project view (already supports `src` as URL). We can do that in a follow-up.
