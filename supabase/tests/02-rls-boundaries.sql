-- 02 — RLS boundary verification.
--
-- The executable form of the RLS matrix in BUILD-SPEC §4.5. Requires the
-- fixtures from 01-schema-behaviour.sql and 00-fixture.sql.
--
-- Every probe runs inside its own transaction with SET LOCAL ROLE and a JWT
-- claim, and catches the error, so one denial does not abort the rest. Running
-- the probes without the role actually being set is the trap here: SET LOCAL
-- outside a transaction is a silent no-op and every query then runs as
-- superuser, which bypasses RLS and makes the whole file look like it passes.

create or replace function pg_temp.probe(p_role text, p_sub text, p_label text, p_sql text)
returns table (probe text, outcome text)
language plpgsql as $$
declare v_result text;
begin
  begin
    perform set_config('role', p_role, true);
    perform set_config('request.jwt.claims',
      case when p_sub is null then json_build_object('role', p_role)::text
           else json_build_object('sub', p_sub, 'role', p_role)::text end, true);
    execute p_sql into v_result;
    perform set_config('role', 'postgres', true);
    return query select p_label, 'returned ' || coalesce(v_result, 'null');
  exception when others then
    perform set_config('role', 'postgres', true);
    return query select p_label, 'DENIED (' || sqlerrm || ')';
  end;
end $$;

\echo ''
\echo '=============== ANON (publishable key, no session) ==============='
select * from pg_temp.probe('anon', null, 'select events',    'select count(*)::text from events');
select * from pg_temp.probe('anon', null, 'select contacts',  'select count(*)::text from contacts');
select * from pg_temp.probe('anon', null, 'select attendees', 'select count(*)::text from attendees');
select * from pg_temp.probe('anon', null, 'select bids',      'select count(*)::text from bids');
select * from pg_temp.probe('anon', null, 'select lots',      'select count(*)::text from lots');
select * from pg_temp.probe('anon', null, 'select auctions',  'select count(*)::text from auctions');
select * from pg_temp.probe('anon', null, 'select lot_state', 'select count(*)::text from lot_state');
select * from pg_temp.probe('anon', null, 'select audit_log', 'select count(*)::text from audit_log');
select * from pg_temp.probe('anon', null, 'call place_bid',
  'select result from place_bid(''55555555-5555-5555-5555-555555555551'',''33333333-3333-3333-3333-333333333331'', 99999)');
select * from pg_temp.probe('anon', null, 'call check_in_attendee',
  'select result from check_in_attendee(''33333333-3333-3333-3333-333333333332'', null)');
select * from pg_temp.probe('anon', null, 'call void_bid',
  'select result from void_bid((select id from bids limit 1), ''x'', null)');

\echo ''
\echo '=============== DOOR STAFF (own department) ==============='
select * from pg_temp.probe('authenticated','bbbbbbbb-0000-0000-0000-00000000000b','select events',     'select count(*)::text from events');
select * from pg_temp.probe('authenticated','bbbbbbbb-0000-0000-0000-00000000000b','select attendees',  'select count(*)::text from attendees');
select * from pg_temp.probe('authenticated','bbbbbbbb-0000-0000-0000-00000000000b','select contacts',   'select count(*)::text from contacts');
select * from pg_temp.probe('authenticated','bbbbbbbb-0000-0000-0000-00000000000b','select bids',       'select count(*)::text from bids');
select * from pg_temp.probe('authenticated','bbbbbbbb-0000-0000-0000-00000000000b','select auctions',   'select count(*)::text from auctions');
select * from pg_temp.probe('authenticated','bbbbbbbb-0000-0000-0000-00000000000b','select broadcasts', 'select count(*)::text from broadcasts');
select * from pg_temp.probe('authenticated','bbbbbbbb-0000-0000-0000-00000000000b','select audit_log',  'select count(*)::text from audit_log');
select * from pg_temp.probe('authenticated','bbbbbbbb-0000-0000-0000-00000000000b','insert event',
  'with i as (insert into events (department_id,title,slug,starts_at) values (''11111111-1111-1111-1111-111111111111'',''Sneaky'',''sneaky-'' || gen_random_uuid(), now()) returning 1) select count(*)::text from i');
select * from pg_temp.probe('authenticated','bbbbbbbb-0000-0000-0000-00000000000b','call place_bid',
  'select result from place_bid(''55555555-5555-5555-5555-555555555551'',''33333333-3333-3333-3333-333333333331'', 99999)');

\echo ''
\echo '=============== ORGANISER (own department) ==============='
select * from pg_temp.probe('authenticated','bbbbbbbb-0000-0000-0000-00000000000a','select events',    'select count(*)::text from events');
select * from pg_temp.probe('authenticated','bbbbbbbb-0000-0000-0000-00000000000a','select contacts',  'select count(*)::text from contacts');
select * from pg_temp.probe('authenticated','bbbbbbbb-0000-0000-0000-00000000000a','select lot_state', 'select count(*)::text from lot_state');
select * from pg_temp.probe('authenticated','bbbbbbbb-0000-0000-0000-00000000000a','select bids',      'select count(*)::text from bids');
select * from pg_temp.probe('authenticated','bbbbbbbb-0000-0000-0000-00000000000a','select audit_log', 'select count(*)::text from audit_log');
select * from pg_temp.probe('authenticated','bbbbbbbb-0000-0000-0000-00000000000a','insert bid directly',
  'with i as (insert into bids (lot_id,attendee_id,amount) values (''55555555-5555-5555-5555-555555555551'',''33333333-3333-3333-3333-333333333331'', 99999) returning 1) select count(*)::text from i');
select * from pg_temp.probe('authenticated','bbbbbbbb-0000-0000-0000-00000000000a','call place_bid',
  'select result from place_bid(''55555555-5555-5555-5555-555555555551'',''33333333-3333-3333-3333-333333333331'', 99999)');
select * from pg_temp.probe('authenticated','bbbbbbbb-0000-0000-0000-00000000000a','insert event in other dept',
  'with i as (insert into events (department_id,title,slug,starts_at) values (''aaaaaaaa-0000-0000-0000-000000000002'',''Cross'',''cross-'' || gen_random_uuid(), now()) returning 1) select count(*)::text from i');
select * from pg_temp.probe('authenticated','bbbbbbbb-0000-0000-0000-00000000000a','insert event in own dept',
  'with i as (insert into events (department_id,title,slug,starts_at) values (''11111111-1111-1111-1111-111111111111'',''Fine'',''fine-'' || gen_random_uuid(), now()) returning 1) select count(*)::text from i');

\echo ''
\echo '=============== ORGANISER OF ANOTHER DEPARTMENT ==============='
select * from pg_temp.probe('authenticated','bbbbbbbb-0000-0000-0000-00000000000c','select events (should see only its own)',
  'select count(*)::text from events');
select * from pg_temp.probe('authenticated','bbbbbbbb-0000-0000-0000-00000000000c','which events',
  'select coalesce(string_agg(title, '', ''), ''none'') from events');
select * from pg_temp.probe('authenticated','bbbbbbbb-0000-0000-0000-00000000000c','select contacts',  'select count(*)::text from contacts');
select * from pg_temp.probe('authenticated','bbbbbbbb-0000-0000-0000-00000000000c','select attendees', 'select count(*)::text from attendees');
select * from pg_temp.probe('authenticated','bbbbbbbb-0000-0000-0000-00000000000c','select lot_state', 'select count(*)::text from lot_state');
select * from pg_temp.probe('authenticated','bbbbbbbb-0000-0000-0000-00000000000c','select bids',      'select count(*)::text from bids');

\echo ''
\echo '=============== SERVICE ROLE (what the server routes use) ==============='
select * from pg_temp.probe('service_role', null, 'select events',    'select count(*)::text from events');
select * from pg_temp.probe('service_role', null, 'select lot_state', 'select count(*)::text from lot_state');
select * from pg_temp.probe('service_role', null, 'select contacts',  'select count(*)::text from contacts');
select * from pg_temp.probe('service_role', null, 'call place_bid (checked-in attendee, open lot)',
  'select result from place_bid(''55555555-5555-5555-5555-555555555551'',''33333333-3333-3333-3333-333333333333'', 3500)');

\echo ''
\echo '=============== RLS coverage across every table ==============='
select c.relname as table_name,
       c.relrowsecurity as rls,
       c.relforcerowsecurity as forced,
       count(p.polname) as policies
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_policy p on p.polrelid = c.oid
 where n.nspname = 'public' and c.relkind = 'r'
 group by 1,2,3 order by 1;
