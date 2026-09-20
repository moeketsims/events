-- 0007 — scheduled jobs
--
-- BUILD-SPEC §4.7. close_due_lots() finalises lots whose time has passed and
-- writes the winner's settlement row.
--
-- lots.closes_at is authoritative, not the schedule: place_bid() rejects a late
-- bid on its own and clients render their countdowns from closes_at. The cron
-- job only moves status and creates settlements, so a late or missed run
-- changes nothing a guest can see except how soon "Closed" appears on the
-- board, and the operator console can always close a lot by hand.
--
-- Sub-minute schedules need pg_cron 1.5 or newer. The block below asks for
-- every 30 seconds and falls back to every minute, which BUILD-SPEC §4.7 names
-- as the acceptable alternative. If pg_cron is not installed at all the
-- migration still succeeds and the operator closes lots manually.

do $$
declare
  v_has_cron boolean;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into v_has_cron;

  if not v_has_cron then
    raise notice 'pg_cron is not installed: close_due_lots() will not run on a schedule. Close lots from the operator console, or enable pg_cron in the Supabase dashboard and re-run this migration.';
    return;
  end if;

  -- cron.unschedule raises if the job does not exist, so check first.
  if exists (select 1 from cron.job where jobname = 'close-due-lots') then
    perform cron.unschedule('close-due-lots');
  end if;

  begin
    perform cron.schedule('close-due-lots', '30 seconds', $cron$select close_due_lots()$cron$);
    raise notice 'close-due-lots scheduled every 30 seconds';
  exception when others then
    perform cron.schedule('close-due-lots', '* * * * *', $cron$select close_due_lots()$cron$);
    raise notice 'pg_cron rejected the 30-second schedule (%); falling back to every minute', sqlerrm;
  end;
end $$;
