# Sync and storage notes

## Data not syncing across devices

If the project loads on one device but not another:

1. **Check what the API returns**  
   On the device where you just saved, open:  
   `https://your-staging-url.vercel.app/api/projects/1`  
   (use your real project id). You should see JSON with `items`, `storyline`, etc.  
   On the other device, open the **same** URL in a **new/incognito** tab. The JSON should be **identical**. If it’s empty or different, the problem is server-side or caching.

2. **Cache**  
   The API now sends `Cache-Control: no-store, no-cache, must-revalidate` for project data so browsers don’t reuse an old response. After deploying, try the other device in an incognito window or after a hard refresh.

3. **Same URL**  
   Both devices must use the **same** deployed URL (e.g. staging). If one uses `localhost` or a different domain, they won’t share the same database.

---

## Deletion: files left in Supabase Storage

When you delete a piece of content in the CMS, the item is removed from the project’s `items` (and saved to the DB), but the **file in Supabase Storage is not deleted**. So Storage can contain “orphan” files that are no longer referenced by any project.

- This is **intentional for now** so we don’t accidentally remove files that might still be in use (e.g. same URL used by another project or item).
- To **clean up orphans** later, you could: run a periodic job that lists objects in `project-media` and deletes any that aren’t referenced in any project’s `items` or `assets`; or add a “Delete from Storage” step when the user deletes an item in the CMS (only if that URL is not used elsewhere).

No automatic Storage deletion is implemented yet.
