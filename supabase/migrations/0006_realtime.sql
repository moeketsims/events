-- 0006 — realtime
--
-- BUILD-SPEC §4.6. The platform uses database broadcast (realtime.send) rather
-- than postgres_changes replication: the payloads are hand-built and
-- anonymised, so nothing sensitive reaches a public channel and no channel
-- authorisation is needed in the POC.
--
-- Topics and payloads:
--
--   event:{eventId}      checkin       {event_id, checked_in_count}
--   event:{eventId}      broadcast     {broadcast_id}
--   auction:{auctionId}  bid_placed    {lot_id, lot_number, amount, bidder_number, closes_at, next_min}
--   auction:{auctionId}  lot_status    {lot_id, status, closes_at}
--   auction:{auctionId}  bid_voided    {lot_id, lot_number, high_bid, high_bidder_number, next_min}
--   auction:{auctionId}  display_mode  {mode, lot_id}
--   attendee:{attendeeId} outbid       {lot_id, lot_number, amount}
--
-- A payload never carries a name, an email or a contact id. Bidder numbers only.
-- Clients treat a payload as a signal that something changed and refetch detail
-- through an authenticated route when they need more than the payload holds.
--
-- lib/realtime.ts mirrors these topic names and payload types in TypeScript.

-- Announce a broadcast to everyone on the event channel. Called from the
-- sendBroadcast Server Action after the deliveries are written, so a client
-- that refetches immediately sees the message it was told about.
create or replace function notify_broadcast(p_broadcast_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_event_id uuid;
begin
  select event_id into v_event_id from broadcasts where id = p_broadcast_id;
  if v_event_id is null then
    raise exception 'broadcast % not found', p_broadcast_id;
  end if;

  perform realtime.send(
    jsonb_build_object('broadcast_id', p_broadcast_id),
    'broadcast', 'event:' || v_event_id, false);
end $$;

revoke all on function notify_broadcast(uuid) from public, anon, authenticated;
grant execute on function notify_broadcast(uuid) to service_role;

-- A one-call smoke test for T1.3: confirms realtime.send is available on this
-- project at all. If this raises, set NEXT_PUBLIC_REALTIME_MODE=poll and the
-- app falls back to polling per BUILD-SPEC §4.6 without any other change.
create or replace function realtime_selftest() returns text
language plpgsql security definer set search_path = public as $$
begin
  perform realtime.send(
    jsonb_build_object('ok', true, 'at', now()),
    'selftest', 'event:selftest', false);
  return 'realtime.send is available';
exception when others then
  return 'realtime.send FAILED: ' || sqlerrm;
end $$;

revoke all on function realtime_selftest() from public, anon;
grant execute on function realtime_selftest() to authenticated, service_role;
