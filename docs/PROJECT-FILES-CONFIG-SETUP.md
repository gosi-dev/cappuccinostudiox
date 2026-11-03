# Project Files 3D config — Supabase setup

The Project Files page (iso-cards, 3D box) loads its config from the server so it’s the same for all visitors. Config is stored in Supabase in a small key-value table.

## One-time setup (copy-paste in Supabase)

1. Open your Supabase project → **SQL Editor**.
2. Run the following SQL (creates the table and allows read/write for the app).

```sql
-- Table: one row per config key. We use key = 'project_files_3d'.
create table if not exists public.site_config (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- Optional: update updated_at on change
create or replace function public.site_config_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists site_config_updated_at on public.site_config;
create trigger site_config_updated_at
  before update on public.site_config
  for each row execute function public.site_config_updated_at();

-- RLS: allow anonymous read and write (no auth yet; anyone can change config)
alter table public.site_config enable row level security;

drop policy if exists "Allow public read site_config" on public.site_config;
create policy "Allow public read site_config" on public.site_config
  for select using (true);

drop policy if exists "Allow public insert site_config" on public.site_config;
create policy "Allow public insert site_config" on public.site_config
  for insert with check (true);

drop policy if exists "Allow public update site_config" on public.site_config;
create policy "Allow public update site_config" on public.site_config
  for update using (true);
```

3. (Optional) Insert a default row so the app always has something to read. You can skip this; the API returns `null` if no row exists and the app falls back to defaults.

```sql
insert into public.site_config (key, value)
values (
  'project_files_3d',
  '{
    "width": 400,
    "height": 300,
    "isoCardCount": 60,
    "isoCardSpacing": 84,
    "isoCardRepelDistance": 40,
    "isoCardRepelDuration": 0.3,
    "rotateX": -30,
    "rotateY": -45,
    "positionX": -27,
    "positionY": 48,
    "positionZ": -216,
    "showFrontFace": false,
    "showBackFace": false,
    "showRightFace": false,
    "showLeftFace": false,
    "showTopFace": false,
    "showBottomFace": false
  }'::jsonb
)
on conflict (key) do nothing;
```

After this, the API and frontend will use this table. No Vercel env changes needed (same `SUPABASE_URL` and `SUPABASE_ANON_KEY`).
