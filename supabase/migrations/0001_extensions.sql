-- 0001 — extensions
--
-- BUILD-SPEC §4.1. citext is listed here rather than mid-table as the spec
-- shows it, because contacts.email depends on it in 0003.

create extension if not exists pgcrypto;
create extension if not exists citext;

-- pg_cron lives in the "extensions" schema on Supabase and is only available on
-- the platform's own images. 0007 schedules close_due_lots() through it; if the
-- extension is unavailable the app still closes lots correctly, because
-- place_bid() rejects late bids on its own and the operator console can close a
-- lot by hand. See 0007 for the fallback.
create extension if not exists pg_cron;
