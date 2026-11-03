-- Add phone to bookings so the booking form can store phone numbers.
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
alter table public.bookings add column if not exists phone text;
