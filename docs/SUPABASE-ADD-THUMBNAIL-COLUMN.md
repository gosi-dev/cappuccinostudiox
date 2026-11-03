# Add missing `thumbnail` column in Supabase

The API expects a **thumbnail** column (for the project card image). Your table doesn't have it yet, so you see:

`{"error":"column projects.thumbnail does not exist"}`

## Fix (one-time)

1. Go to **Supabase** → your project → **SQL Editor**.
2. Click **New query**.
3. Paste this and click **Run**:

```sql
alter table projects
add column if not exists thumbnail text;
```

4. You should see: **Success. No rows returned.**

After that, save again from the project edit page; the error should be gone and data will sync.
