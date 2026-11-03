-- Bookings: service, datetime, contact, status
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  service text,
  datetime timestamptz,
  name text,
  email text,
  status text default 'pending',
  created_at timestamptz default now()
);

-- Waitlist: email signups by product
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  product text,
  created_at timestamptz default now()
);

-- Optional: enable RLS and add policies as needed
-- alter table public.bookings enable row level security;
-- alter table public.waitlist enable row level security;
