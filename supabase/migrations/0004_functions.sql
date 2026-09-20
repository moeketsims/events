-- 0004 — views and functions
--
-- BUILD-SPEC §4.3 and §4.4. The views come first because next_min_bid() reads
-- lot_state, and place_bid() reads next_min_bid().

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

-- Current high bid per lot, anonymised: a bidder number, never a name.
create or replace view lot_state
with (security_invoker = on) as
select
  l.id as lot_id,
  l.auction_id,
  l.lot_number,
  l.title,
  l.status,
  l.closes_at,
  l.starting_bid,
  l.reserve,
  b.amount as high_bid,
  a.bidder_number as high_bidder_number,
  (select count(*) from bids x where x.lot_id = l.id and x.voided_at is null) as bid_count
from lots l
left join lateral (
  select amount, attendee_id from bids
  where lot_id = l.id and voided_at is null
  order by amount desc, placed_at asc limit 1
) b on true
left join attendees a on a.id = b.attendee_id;

-- Totals for the projection footer.
create or replace view auction_totals
with (security_invoker = on) as
select
  auction_id,
  coalesce(sum(high_bid), 0) as total_raised,
  count(*) filter (where high_bid is not null) as lots_with_bids
from lot_state
group by auction_id;

-- ---------------------------------------------------------------------------
-- Helpers used by RLS
--
-- These are security definer so that a policy on profiles can call them
-- without recursing into its own policy.
-- ---------------------------------------------------------------------------

create or replace function auth_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function auth_department() returns uuid
language sql stable security definer set search_path = public as $$
  select department_id from profiles where id = auth.uid()
$$;

create or replace function is_platform_admin() returns boolean
language sql stable as $$ select coalesce(auth_role() = 'platform_admin', false) $$;

-- In the POC the organiser also acts as auction operator (BUILD-SPEC §4.5).
create or replace function is_operator() returns boolean
language sql stable as $$
  select coalesce(auth_role() in ('organiser','auction_operator','platform_admin'), false)
$$;

-- ---------------------------------------------------------------------------
-- Profile auto-create
-- ---------------------------------------------------------------------------

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Increment maths
--
-- Mirrored in lib/money.ts. tests/unit/money.test.ts pins the TypeScript to the
-- same table of cases as sql_parity() below; keep the three in step.
-- ---------------------------------------------------------------------------

create or replace function bid_step(p_table jsonb, p_current numeric) returns numeric
language plpgsql immutable as $$
declare r jsonb;
begin
  for r in select * from jsonb_array_elements(p_table) loop
    if (r->>'upTo') is null or p_current < (r->>'upTo')::numeric then
      return (r->>'step')::numeric;
    end if;
  end loop;
  return 100;
end $$;

create or replace function next_min_bid(p_lot_id uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select case when ls.high_bid is null then ls.starting_bid
              else ls.high_bid + bid_step(a.increment_table, ls.high_bid) end
  from lot_state ls join auctions a on a.id = ls.auction_id
  where ls.lot_id = p_lot_id
$$;

-- ---------------------------------------------------------------------------
-- Check-in
--
-- Called from /api/checkin once the server has verified the pass token
-- signature. p_event_id is an addition to the BUILD-SPEC §4.4 signature: the
-- scanner is always pointed at one event and the route contract in §7.2 has a
-- 'wrong_event' result, so the check belongs here rather than in a second
-- round trip. Passing null skips it.
-- ---------------------------------------------------------------------------

create or replace function check_in_attendee(
  p_attendee_id uuid,
  p_staff_id uuid,
  p_event_id uuid default null
)
returns table (result text, display_name text, bidder_number int, checked_in_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_att attendees%rowtype;
  v_event events%rowtype;
  v_next int;
begin
  select * into v_att from attendees where id = p_attendee_id for update;
  if not found then
    return query select 'invalid', null::text, null::int, null::timestamptz; return;
  end if;

  if p_event_id is not null and v_att.event_id <> p_event_id then
    return query select 'wrong_event', null::text, null::int, null::timestamptz; return;
  end if;

  select * into v_event from events where id = v_att.event_id;

  if v_att.checked_in_at is not null then
    return query select 'already_checked_in', v_att.display_name, v_att.bidder_number, v_att.checked_in_at;
    return;
  end if;

  if v_event.auction_enabled and v_att.bidder_number is null then
    -- Serialise per event so numbers are unique and sequential even when two
    -- ushers scan at the same instant.
    perform pg_advisory_xact_lock(hashtext(v_att.event_id::text));
    -- Every column here is aliased: result, display_name, bidder_number and
    -- checked_in_at are OUT parameters of this function, so an unqualified
    -- reference to one of them is ambiguous between the variable and the
    -- column and Postgres refuses to run the statement.
    select coalesce(max(a.bidder_number), 0) + 1 into v_next
      from attendees a where a.event_id = v_att.event_id;
    v_att.bidder_number := v_next;
  end if;

  update attendees
     set checked_in_at = now(), checked_in_by = p_staff_id, bidder_number = v_att.bidder_number
   where id = p_attendee_id
   returning * into v_att;

  -- The first arrival puts the event on air.
  update events set status = 'live'
   where id = v_att.event_id and status = 'published';

  perform realtime.send(
    jsonb_build_object(
      'event_id', v_att.event_id,
      'checked_in_count',
      (select count(*) from attendees a
        where a.event_id = v_att.event_id and a.checked_in_at is not null)),
    'checkin', 'event:' || v_att.event_id, false);

  return query select 'checked_in', v_att.display_name, v_att.bidder_number, v_att.checked_in_at;
end $$;

-- ---------------------------------------------------------------------------
-- Place bid — the single path for every bid in the system
--
-- The lot row is locked for the duration, so two simultaneous bids serialise
-- and cannot both win. Nothing else in the codebase inserts into bids.
-- ---------------------------------------------------------------------------

create or replace function place_bid(
  p_lot_id uuid,
  p_attendee_id uuid,
  p_amount numeric,
  p_is_proxy boolean default false,
  p_staff_id uuid default null
)
returns table (result text, bid_id uuid, high_bid numeric, next_min numeric, closes_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_lot lots%rowtype;
  v_auction auctions%rowtype;
  v_att attendees%rowtype;
  v_min numeric;
  v_bid_id uuid;
  v_prev_attendee uuid;
  v_now timestamptz := now();
begin
  select * into v_lot from lots where id = p_lot_id for update;
  if not found then
    return query select 'lot_not_found', null::uuid, null::numeric, null::numeric, null::timestamptz;
    return;
  end if;

  select * into v_auction from auctions where id = v_lot.auction_id;
  select * into v_att from attendees where id = p_attendee_id;

  if v_att.id is null or v_att.event_id <> v_auction.event_id then
    return query select 'not_an_attendee', null::uuid, null::numeric, null::numeric, null::timestamptz;
    return;
  end if;

  if v_att.checked_in_at is null then
    return query select 'not_checked_in', null::uuid, null::numeric, null::numeric, null::timestamptz;
    return;
  end if;

  if v_lot.status <> 'open' or (v_lot.closes_at is not null and v_now >= v_lot.closes_at) then
    return query select 'lot_closed', null::uuid, null::numeric, null::numeric, v_lot.closes_at;
    return;
  end if;

  v_min := next_min_bid(p_lot_id);
  if p_amount < v_min then
    return query select 'too_low',
                        null::uuid,
                        (select ls.high_bid from lot_state ls where ls.lot_id = p_lot_id),
                        v_min,
                        v_lot.closes_at;
    return;
  end if;

  select b.attendee_id into v_prev_attendee from bids b
   where b.lot_id = p_lot_id and b.voided_at is null
   order by b.amount desc, b.placed_at asc limit 1;

  insert into bids (lot_id, attendee_id, amount, is_proxy, placed_by_user_id)
  values (p_lot_id, p_attendee_id, p_amount, p_is_proxy, p_staff_id)
  returning id into v_bid_id;

  -- Anti-sniping soft close: a bid inside the window pushes the close out.
  if v_lot.closes_at is not null
     and v_lot.closes_at - v_now < make_interval(secs => v_auction.soft_close_seconds) then
    update lots set closes_at = v_now + make_interval(secs => v_auction.soft_close_seconds)
     where id = p_lot_id returning * into v_lot;
  end if;

  perform realtime.send(
    jsonb_build_object('lot_id', p_lot_id, 'lot_number', v_lot.lot_number, 'amount', p_amount,
                       'bidder_number', v_att.bidder_number, 'closes_at', v_lot.closes_at,
                       'next_min', p_amount + bid_step(v_auction.increment_table, p_amount)),
    'bid_placed', 'auction:' || v_auction.id, false);

  if v_prev_attendee is not null and v_prev_attendee <> p_attendee_id then
    perform realtime.send(
      jsonb_build_object('lot_id', p_lot_id, 'lot_number', v_lot.lot_number, 'amount', p_amount),
      'outbid', 'attendee:' || v_prev_attendee, false);
  end if;

  return query select 'ok', v_bid_id, p_amount,
                      p_amount + bid_step(v_auction.increment_table, p_amount),
                      v_lot.closes_at;
end $$;

-- ---------------------------------------------------------------------------
-- Lot lifecycle
-- ---------------------------------------------------------------------------

create or replace function set_lot_status(
  p_lot_id uuid,
  p_status lot_status,
  p_closes_at timestamptz default null
)
returns lots language plpgsql security definer set search_path = public as $$
declare v lots%rowtype;
begin
  update lots set status = p_status,
         closes_at = coalesce(p_closes_at, closes_at),
         opens_at = case when p_status = 'open' and opens_at is null then now() else opens_at end
   where id = p_lot_id returning * into v;

  if not found then
    raise exception 'lot % not found', p_lot_id;
  end if;

  perform realtime.send(
    jsonb_build_object('lot_id', v.id, 'status', v.status, 'closes_at', v.closes_at),
    'lot_status', 'auction:' || v.auction_id, false);
  return v;
end $$;

-- Called by pg_cron; finalises lots whose time has passed and creates the
-- settlement row for the winner. Restructured from the BUILD-SPEC §4.4 listing:
-- the due lots are locked on the lots table alone rather than through a join to
-- lot_state, because FOR UPDATE against a view with a lateral join is fragile.
-- The behaviour is identical.
create or replace function close_due_lots() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int := 0;
  r record;
  v_high numeric;
begin
  for r in select l.id, l.reserve
             from lots l
            where l.status = 'open'
              and l.closes_at is not null
              and l.closes_at <= now()
            for update skip locked loop

    select b.amount into v_high from bids b
     where b.lot_id = r.id and b.voided_at is null
     order by b.amount desc, b.placed_at asc limit 1;

    if v_high is null or (r.reserve is not null and v_high < r.reserve) then
      perform set_lot_status(r.id, 'unsold');
    else
      perform set_lot_status(r.id, 'closed');
      insert into settlements (lot_id, attendee_id, amount)
      select r.id, b.attendee_id, b.amount from bids b
       where b.lot_id = r.id and b.voided_at is null
       order by b.amount desc, b.placed_at asc limit 1
      on conflict (lot_id) do nothing;
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- Operator actions
-- ---------------------------------------------------------------------------

-- Voids a bid, writes the audit row, and re-broadcasts the lot's new state.
-- The bid is never deleted: the ledger stays append-only.
create or replace function void_bid(p_bid_id uuid, p_reason text, p_staff_id uuid)
returns table (result text, high_bid numeric, high_bidder_number int, next_min numeric)
language plpgsql security definer set search_path = public as $$
declare
  v_bid bids%rowtype;
  v_lot lots%rowtype;
  v_state record;
begin
  select * into v_bid from bids where id = p_bid_id for update;
  if not found then
    return query select 'bid_not_found', null::numeric, null::int, null::numeric; return;
  end if;
  if v_bid.voided_at is not null then
    return query select 'already_voided', null::numeric, null::int, null::numeric; return;
  end if;

  select * into v_lot from lots where id = v_bid.lot_id;

  update bids set voided_at = now(), void_reason = p_reason where id = p_bid_id;

  insert into audit_log (actor_id, action, entity, entity_id, metadata)
  values (p_staff_id, 'bid.voided', 'bids', p_bid_id,
          jsonb_build_object('lot_id', v_bid.lot_id, 'amount', v_bid.amount,
                             'attendee_id', v_bid.attendee_id, 'reason', p_reason));

  select ls.high_bid, ls.high_bidder_number into v_state
    from lot_state ls where ls.lot_id = v_bid.lot_id;

  perform realtime.send(
    jsonb_build_object('lot_id', v_bid.lot_id, 'lot_number', v_lot.lot_number,
                       'high_bid', v_state.high_bid,
                       'high_bidder_number', v_state.high_bidder_number,
                       'next_min', next_min_bid(v_bid.lot_id)),
    'bid_voided', 'auction:' || v_lot.auction_id, false);

  return query select 'ok', v_state.high_bid, v_state.high_bidder_number, next_min_bid(v_bid.lot_id);
end $$;

create or replace function set_display_mode(
  p_auction_id uuid,
  p_mode text,
  p_lot_id uuid default null
)
returns auctions language plpgsql security definer set search_path = public as $$
declare v auctions%rowtype;
begin
  update auctions set display_mode = p_mode, spotlight_lot_id = p_lot_id
   where id = p_auction_id returning * into v;

  if not found then
    raise exception 'auction % not found', p_auction_id;
  end if;

  perform realtime.send(
    jsonb_build_object('mode', v.display_mode, 'lot_id', v.spotlight_lot_id),
    'display_mode', 'auction:' || v.id, false);
  return v;
end $$;

-- Records that a member of staff looked behind a bidder number. Every reveal on
-- the operator console writes one of these.
create or replace function log_audit(
  p_actor_id uuid,
  p_action text,
  p_entity text,
  p_entity_id uuid,
  p_metadata jsonb default '{}'::jsonb
) returns void
language sql security definer set search_path = public as $$
  insert into audit_log (actor_id, action, entity, entity_id, metadata)
  values (p_actor_id, p_action, p_entity, p_entity_id, p_metadata)
$$;

-- ---------------------------------------------------------------------------
-- Execute privileges
--
-- Supabase grants EXECUTE on new public functions to anon and authenticated by
-- default. These functions are SECURITY DEFINER, so leaving that in place would
-- let anyone holding the publishable key call place_bid or check_in_attendee
-- directly and bypass every server-side check. CLAUDE.md is explicit that there
-- is one bid path; this is what enforces it at the database boundary.
-- ---------------------------------------------------------------------------

do $$
declare fn text;
begin
  foreach fn in array array[
    'place_bid(uuid,uuid,numeric,boolean,uuid)',
    'check_in_attendee(uuid,uuid,uuid)',
    'close_due_lots()',
    'set_lot_status(uuid,lot_status,timestamptz)',
    'void_bid(uuid,text,uuid)',
    'set_display_mode(uuid,text,uuid)',
    'log_audit(uuid,text,text,uuid,jsonb)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;

-- RLS policies call these on every row, so authenticated must keep them.
grant execute on function auth_role() to authenticated, service_role;
grant execute on function auth_department() to authenticated, service_role;
grant execute on function is_platform_admin() to authenticated, service_role;
grant execute on function is_operator() to authenticated, service_role;
grant execute on function bid_step(jsonb, numeric) to authenticated, anon, service_role;
grant execute on function next_min_bid(uuid) to authenticated, service_role;
