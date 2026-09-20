-- 0005 — Row Level Security
--
-- BUILD-SPEC §4.5. RLS is on for every table in 0003, from the same push that
-- creates them. Nothing in this schema is reachable without a policy.
--
-- Two things to hold in mind when reading this file:
--
--  1. Attendee-facing pages never touch these tables with the browser client.
--     They are rendered server-side with the service-role client, which bypasses
--     RLS entirely, and return only the fields BUILD-SPEC §7.3 lists. The
--     browser gets the publishable key only for realtime subscriptions and for
--     staff sessions. So "anon" has no policy anywhere, deliberately.
--
--  2. In the POC the organiser also acts as auction operator (§4.5), so
--     is_operator() covers organiser, auction_operator and platform_admin.

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'departments','profiles','contacts','consents','events','event_questions',
    'invitations','rsvps','attendees','message_deliveries','broadcasts',
    'auctions','lots','bids','settlements','audit_log'
  ] loop
    execute format('alter table %I enable row level security', t);
    -- Even the table owner is subject to these policies. The service-role key
    -- still bypasses RLS because it uses a BYPASSRLS role, which is what the
    -- server routes rely on.
    execute format('alter table %I force row level security', t);
  end loop;
end $$;

-- Start from a clean slate so the migration is safe to re-run.
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- departments
-- ---------------------------------------------------------------------------

create policy departments_admin_all on departments for all to authenticated
  using (is_platform_admin()) with check (is_platform_admin());

create policy departments_own_select on departments for select to authenticated
  using (id = auth_department());

-- ---------------------------------------------------------------------------
-- profiles
--
-- The policies here must not call a helper that reads profiles without
-- SECURITY DEFINER, or the policy recurses into itself. auth_role() and
-- auth_department() are definer functions for exactly this reason.
-- ---------------------------------------------------------------------------

create policy profiles_admin_all on profiles for all to authenticated
  using (is_platform_admin()) with check (is_platform_admin());

create policy profiles_self_select on profiles for select to authenticated
  using (id = auth.uid());

create policy profiles_dept_select on profiles for select to authenticated
  using (department_id = auth_department() and auth_role() in ('organiser','auction_operator'));

-- ---------------------------------------------------------------------------
-- contacts
--
-- Door staff never read contacts directly. The scanner's name search goes
-- through a server route that reads attendees.display_name, which is
-- denormalised on purpose so the door never needs the donor record.
-- ---------------------------------------------------------------------------

create policy contacts_admin_all on contacts for all to authenticated
  using (is_platform_admin()) with check (is_platform_admin());

create policy contacts_dept_select on contacts for select to authenticated
  using (department_id = auth_department()
         and auth_role() in ('organiser','auction_operator','finance'));

create policy contacts_dept_insert on contacts for insert to authenticated
  with check (department_id = auth_department() and auth_role() = 'organiser');

create policy contacts_dept_update on contacts for update to authenticated
  using (department_id = auth_department() and auth_role() = 'organiser')
  with check (department_id = auth_department());

create policy contacts_dept_delete on contacts for delete to authenticated
  using (department_id = auth_department() and auth_role() = 'organiser');

-- ---------------------------------------------------------------------------
-- consents
-- ---------------------------------------------------------------------------

create policy consents_admin_all on consents for all to authenticated
  using (is_platform_admin()) with check (is_platform_admin());

create policy consents_dept_select on consents for select to authenticated
  using (exists (select 1 from contacts c
                  where c.id = consents.contact_id
                    and c.department_id = auth_department())
         and auth_role() = 'organiser');

-- Door staff insert a consent row for every walk-in they register.
create policy consents_dept_insert on consents for insert to authenticated
  with check (exists (select 1 from contacts c
                       where c.id = consents.contact_id
                         and c.department_id = auth_department())
              and auth_role() in ('organiser','door_staff'));

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------

create policy events_admin_all on events for all to authenticated
  using (is_platform_admin()) with check (is_platform_admin());

create policy events_dept_select on events for select to authenticated
  using (department_id = auth_department());

create policy events_dept_insert on events for insert to authenticated
  with check (department_id = auth_department() and auth_role() = 'organiser');

create policy events_dept_update on events for update to authenticated
  using (department_id = auth_department() and auth_role() = 'organiser')
  with check (department_id = auth_department());

create policy events_dept_delete on events for delete to authenticated
  using (department_id = auth_department() and auth_role() = 'organiser');

-- ---------------------------------------------------------------------------
-- event_questions
-- ---------------------------------------------------------------------------

create policy event_questions_admin_all on event_questions for all to authenticated
  using (is_platform_admin()) with check (is_platform_admin());

create policy event_questions_dept_select on event_questions for select to authenticated
  using (exists (select 1 from events e
                  where e.id = event_questions.event_id
                    and e.department_id = auth_department()));

create policy event_questions_dept_write on event_questions for all to authenticated
  using (exists (select 1 from events e
                  where e.id = event_questions.event_id
                    and e.department_id = auth_department())
         and auth_role() = 'organiser')
  with check (exists (select 1 from events e
                       where e.id = event_questions.event_id
                         and e.department_id = auth_department())
              and auth_role() = 'organiser');

-- ---------------------------------------------------------------------------
-- invitations
-- ---------------------------------------------------------------------------

create policy invitations_admin_all on invitations for all to authenticated
  using (is_platform_admin()) with check (is_platform_admin());

create policy invitations_dept_select on invitations for select to authenticated
  using (exists (select 1 from events e
                  where e.id = invitations.event_id
                    and e.department_id = auth_department()));

create policy invitations_dept_write on invitations for all to authenticated
  using (exists (select 1 from events e
                  where e.id = invitations.event_id
                    and e.department_id = auth_department())
         and auth_role() = 'organiser')
  with check (exists (select 1 from events e
                       where e.id = invitations.event_id
                         and e.department_id = auth_department())
              and auth_role() = 'organiser');

-- ---------------------------------------------------------------------------
-- rsvps
-- ---------------------------------------------------------------------------

create policy rsvps_admin_all on rsvps for all to authenticated
  using (is_platform_admin()) with check (is_platform_admin());

create policy rsvps_dept_select on rsvps for select to authenticated
  using (exists (select 1 from invitations i
                   join events e on e.id = i.event_id
                  where i.id = rsvps.invitation_id
                    and e.department_id = auth_department()));

-- ---------------------------------------------------------------------------
-- attendees
--
-- Door staff read and check in. The check-in itself runs through
-- check_in_attendee(), a security-definer function callable only by the
-- service role, so the update policy here covers only the manual
-- "check in from the register" button on the organiser's attendance page.
-- ---------------------------------------------------------------------------

create policy attendees_admin_all on attendees for all to authenticated
  using (is_platform_admin()) with check (is_platform_admin());

create policy attendees_dept_select on attendees for select to authenticated
  using (exists (select 1 from events e
                  where e.id = attendees.event_id
                    and e.department_id = auth_department()));

create policy attendees_dept_write on attendees for all to authenticated
  using (exists (select 1 from events e
                  where e.id = attendees.event_id
                    and e.department_id = auth_department())
         and auth_role() = 'organiser')
  with check (exists (select 1 from events e
                       where e.id = attendees.event_id
                         and e.department_id = auth_department())
              and auth_role() = 'organiser');

-- ---------------------------------------------------------------------------
-- message_deliveries
-- ---------------------------------------------------------------------------

create policy message_deliveries_admin_all on message_deliveries for all to authenticated
  using (is_platform_admin()) with check (is_platform_admin());

create policy message_deliveries_dept_select on message_deliveries for select to authenticated
  using (exists (select 1 from events e
                  where e.id = message_deliveries.event_id
                    and e.department_id = auth_department())
         and auth_role() = 'organiser');

create policy message_deliveries_dept_insert on message_deliveries for insert to authenticated
  with check (exists (select 1 from events e
                       where e.id = message_deliveries.event_id
                         and e.department_id = auth_department())
              and auth_role() = 'organiser');

-- ---------------------------------------------------------------------------
-- broadcasts
-- ---------------------------------------------------------------------------

create policy broadcasts_admin_all on broadcasts for all to authenticated
  using (is_platform_admin()) with check (is_platform_admin());

create policy broadcasts_dept_all on broadcasts for all to authenticated
  using (exists (select 1 from events e
                  where e.id = broadcasts.event_id
                    and e.department_id = auth_department())
         and auth_role() = 'organiser')
  with check (exists (select 1 from events e
                       where e.id = broadcasts.event_id
                         and e.department_id = auth_department())
              and auth_role() = 'organiser');

-- ---------------------------------------------------------------------------
-- auctions and lots
-- ---------------------------------------------------------------------------

create policy auctions_admin_all on auctions for all to authenticated
  using (is_platform_admin()) with check (is_platform_admin());

create policy auctions_dept_select on auctions for select to authenticated
  using (exists (select 1 from events e
                  where e.id = auctions.event_id
                    and e.department_id = auth_department())
         and auth_role() in ('organiser','auction_operator','finance'));

create policy auctions_dept_write on auctions for all to authenticated
  using (exists (select 1 from events e
                  where e.id = auctions.event_id
                    and e.department_id = auth_department())
         and is_operator())
  with check (exists (select 1 from events e
                       where e.id = auctions.event_id
                         and e.department_id = auth_department())
              and is_operator());

create policy lots_admin_all on lots for all to authenticated
  using (is_platform_admin()) with check (is_platform_admin());

create policy lots_dept_select on lots for select to authenticated
  using (exists (select 1 from auctions a
                   join events e on e.id = a.event_id
                  where a.id = lots.auction_id
                    and e.department_id = auth_department())
         and auth_role() in ('organiser','auction_operator','finance'));

create policy lots_dept_write on lots for all to authenticated
  using (exists (select 1 from auctions a
                   join events e on e.id = a.event_id
                  where a.id = lots.auction_id
                    and e.department_id = auth_department())
         and is_operator())
  with check (exists (select 1 from auctions a
                        join events e on e.id = a.event_id
                       where a.id = lots.auction_id
                         and e.department_id = auth_department())
              and is_operator());

-- ---------------------------------------------------------------------------
-- bids
--
-- Read-only for every role. There is no insert policy at all: the only way a
-- bid enters the ledger is place_bid(), and the only way to remove one is
-- void_bid(), both security-definer and both callable by the service role
-- alone. That is what "one bid path" means in the database.
-- ---------------------------------------------------------------------------

create policy bids_admin_select on bids for select to authenticated
  using (is_platform_admin());

create policy bids_dept_select on bids for select to authenticated
  using (exists (select 1 from lots l
                   join auctions a on a.id = l.auction_id
                   join events e on e.id = a.event_id
                  where l.id = bids.lot_id
                    and e.department_id = auth_department())
         and auth_role() in ('organiser','auction_operator','finance'));

-- ---------------------------------------------------------------------------
-- settlements
-- ---------------------------------------------------------------------------

create policy settlements_admin_all on settlements for all to authenticated
  using (is_platform_admin()) with check (is_platform_admin());

create policy settlements_dept_select on settlements for select to authenticated
  using (exists (select 1 from lots l
                   join auctions a on a.id = l.auction_id
                   join events e on e.id = a.event_id
                  where l.id = settlements.lot_id
                    and e.department_id = auth_department())
         and auth_role() in ('organiser','auction_operator','finance'));

create policy settlements_finance_write on settlements for update to authenticated
  using (exists (select 1 from lots l
                   join auctions a on a.id = l.auction_id
                   join events e on e.id = a.event_id
                  where l.id = settlements.lot_id
                    and e.department_id = auth_department())
         and auth_role() in ('finance','organiser'))
  with check (true);

-- ---------------------------------------------------------------------------
-- audit_log
--
-- Readable by platform admin only, and never written from a policy path:
-- log_audit() and void_bid() write it as the service role.
-- ---------------------------------------------------------------------------

create policy audit_log_admin_select on audit_log for select to authenticated
  using (is_platform_admin());

-- ---------------------------------------------------------------------------
-- Views
--
-- lot_state and auction_totals are security_invoker, so the policies above
-- govern them. Revoke from anon so a leaked publishable key cannot enumerate a
-- board; the projection and attendee pages are served by routes that use the
-- service-role client.
-- ---------------------------------------------------------------------------

revoke all on lot_state from anon;
revoke all on auction_totals from anon;
grant select on lot_state to authenticated, service_role;
grant select on auction_totals to authenticated, service_role;
