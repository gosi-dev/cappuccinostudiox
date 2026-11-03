-- Add name and tier to waitlist for Join Waitlist modal (Regular / Priority Access).
-- Run in Supabase: Dashboard → SQL Editor → New query → paste → Run.
alter table public.waitlist add column if not exists name text;
alter table public.waitlist add column if not exists tier text;
