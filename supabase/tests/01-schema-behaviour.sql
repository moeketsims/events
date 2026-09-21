\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- Fixture
-- ---------------------------------------------------------------------------
insert into departments (id, name, slug)
values ('11111111-1111-1111-1111-111111111111', 'Verify Dept', 'verify');

insert into events (id, department_id, title, slug, starts_at, capacity, auction_enabled, status)
values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
        'Verify Gala', 'verify-gala', now() + interval '1 day', 200, true, 'published');

insert into attendees (id, event_id, display_name, pass_token) values
  ('33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222222', 'Alpha A', 'p.aaa.aaa'),
  ('33333333-3333-3333-3333-333333333332', '22222222-2222-2222-2222-222222222222', 'Bravo B', 'p.bbb.bbb'),
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Charlie C', 'p.ccc.ccc');

insert into auctions (id, event_id, soft_close_seconds)
values ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 120);

insert into lots (id, auction_id, lot_number, title, starting_bid, reserve, status, closes_at) values
  ('55555555-5555-5555-5555-555555555551', '44444444-4444-4444-4444-444444444444', 1, 'Clarens weekend', 3000, null, 'open', now() + interval '1 hour'),
  ('55555555-5555-5555-5555-555555555552', '44444444-4444-4444-4444-444444444444', 2, 'Cheetahs jersey', 1500, null, 'upcoming', now() + interval '1 hour'),
  ('55555555-5555-5555-5555-555555555553', '44444444-4444-4444-4444-444444444444', 3, 'Graduate artwork', 5000, 6000, 'open', now() + interval '1 hour'),
  ('55555555-5555-5555-5555-555555555554', '44444444-4444-4444-4444-444444444444', 4, 'Soft close probe', 1000, null, 'open', now() + interval '90 seconds');

\echo '=== 1. lot_state on an empty lot: high_bid null, next_min = starting_bid ==='
select lot_number, high_bid, high_bidder_number, bid_count,
       next_min_bid(lot_id) as next_min
  from lot_state where auction_id = '44444444-4444-4444-4444-444444444444' order by lot_number;

\echo '=== 2. a bid from an attendee who has not checked in is refused ==='
select result from place_bid('55555555-5555-5555-5555-555555555551', '33333333-3333-3333-3333-333333333331', 3000);

\echo '=== 3. check-in assigns sequential bidder numbers and returns checked_in ==='
select * from check_in_attendee('33333333-3333-3333-3333-333333333331', null, '22222222-2222-2222-2222-222222222222');
select * from check_in_attendee('33333333-3333-3333-3333-333333333332', null, '22222222-2222-2222-2222-222222222222');
select * from check_in_attendee('33333333-3333-3333-3333-333333333333', null, '22222222-2222-2222-2222-222222222222');

\echo '=== 4. a second scan says already_checked_in, and the event went live ==='
select result, bidder_number from check_in_attendee('33333333-3333-3333-3333-333333333331', null, '22222222-2222-2222-2222-222222222222');
select status as event_status from events where id = '22222222-2222-2222-2222-222222222222';

\echo '=== 5. a pass from another event is rejected ==='
select result from check_in_attendee('33333333-3333-3333-3333-333333333331', null, '22222222-2222-2222-2222-222222222229');
select result from check_in_attendee('99999999-9999-9999-9999-999999999999', null, '22222222-2222-2222-2222-222222222222');

\echo '=== 6. first valid bid at the starting bid is accepted ==='
select result, high_bid, next_min from place_bid('55555555-5555-5555-5555-555555555551', '33333333-3333-3333-3333-333333333331', 3000);

\echo '=== 7. a bid below the minimum is refused and reports the minimum ==='
select result, high_bid, next_min from place_bid('55555555-5555-5555-5555-555555555551', '33333333-3333-3333-3333-333333333332', 3100);

\echo '=== 8. a bid at the minimum from a second bidder is accepted (3000 + 250) ==='
select result, high_bid, next_min from place_bid('55555555-5555-5555-5555-555555555551', '33333333-3333-3333-3333-333333333332', 3250);

\echo '=== 9. an attendee of another event cannot bid ==='
insert into events (id, department_id, title, slug, starts_at, auction_enabled)
values ('22222222-2222-2222-2222-222222222229', '11111111-1111-1111-1111-111111111111', 'Other', 'other', now(), false);
insert into attendees (id, event_id, display_name, pass_token, checked_in_at)
values ('33333333-3333-3333-3333-333333333339', '22222222-2222-2222-2222-222222222229', 'Delta D', 'p.ddd.ddd', now());
select result from place_bid('55555555-5555-5555-5555-555555555551', '33333333-3333-3333-3333-333333333339', 5000);

\echo '=== 10. a lot that is not open refuses bids ==='
select result from place_bid('55555555-5555-5555-5555-555555555552', '33333333-3333-3333-3333-333333333331', 1500);

\echo '=== 11. the ledger is strictly increasing and the board shows the leader ==='
select lot_number, high_bid, high_bidder_number, bid_count, next_min_bid(lot_id) as next_min
  from lot_state where lot_number = 1;

\echo '=== 12. soft close: a bid inside the 120 s window pushes closes_at out ==='
select lot_number, closes_at - now() as before from lots where lot_number = 4;
select result, closes_at from place_bid('55555555-5555-5555-5555-555555555554', '33333333-3333-3333-3333-333333333331', 1000);
select lot_number, closes_at - now() as after_extension,
       (closes_at - now()) > interval '110 seconds' as extended
  from lots where lot_number = 4;

\echo '=== 13. a bid after close is refused ==='
update lots set closes_at = now() - interval '1 second' where lot_number = 4;
select result from place_bid('55555555-5555-5555-5555-555555555554', '33333333-3333-3333-3333-333333333332', 99999);

\echo '=== 14. close_due_lots settles the winner and marks under-reserve lots unsold ==='
select result from place_bid('55555555-5555-5555-5555-555555555553', '33333333-3333-3333-3333-333333333333', 5000);
update lots set closes_at = now() - interval '1 second' where lot_number in (3, 4);
select close_due_lots() as lots_finalised;
select l.lot_number, l.status, s.amount as settlement_amount, a.display_name as winner
  from lots l
  left join settlements s on s.lot_id = l.id
  left join attendees a on a.id = s.attendee_id
 where l.lot_number in (3, 4) order by l.lot_number;

\echo '=== 15. close_due_lots is idempotent ==='
select close_due_lots() as second_run_should_be_zero;

\echo '=== 16. void_bid rolls the board back and writes an audit row ==='
select result, high_bid, high_bidder_number, next_min
  from void_bid((select id from bids where lot_id = '55555555-5555-5555-5555-555555555551'
                  order by amount desc limit 1), 'demo: bidder withdrew', null);
select lot_number, high_bid, high_bidder_number from lot_state where lot_number = 1;
select action, entity, metadata->>'reason' as reason from audit_log where action = 'bid.voided';

\echo '=== 17. voided bids stay in the ledger ==='
select count(*) as total_bids, count(voided_at) as voided
  from bids where lot_id = '55555555-5555-5555-5555-555555555551';

\echo '=== 18. auction_totals ==='
select * from auction_totals where auction_id = '44444444-4444-4444-4444-444444444444';

\echo '=== 19. set_display_mode ==='
select display_mode, spotlight_lot_id is not null as has_spotlight
  from set_display_mode('44444444-4444-4444-4444-444444444444', 'spotlight', '55555555-5555-5555-5555-555555555551');

\echo '=== 20. bidder numbers are unique per event ==='
select event_id, count(*) as n, count(distinct bidder_number) as distinct_numbers,
       min(bidder_number) as lo, max(bidder_number) as hi
  from attendees where bidder_number is not null group by event_id;

\echo '=== 21. self-registration (0010): join_token is unique across events ==='
update events
   set join_token = 'j.AAAAAAAAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB',
       join_nonce = '66666666-6666-6666-6666-666666666666'
 where id = '22222222-2222-2222-2222-222222222222';
select join_token is not null as join_on, join_nonce from events where id = '22222222-2222-2222-2222-222222222222';
do $$
begin
  update events set join_token = 'j.AAAAAAAAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB'
   where id = '22222222-2222-2222-2222-222222222229';
  raise exception 'duplicate join_token was accepted';
exception when unique_violation then
  raise notice 'duplicate join_token rejected: %', sqlerrm;
end $$;

\echo '=== 22. self-registration: a walk-in checked in with a null staff id gets the next bidder number ==='
insert into attendees (id, event_id, display_name, pass_token, is_walk_in)
values ('33333333-3333-3333-3333-333333333334', '22222222-2222-2222-2222-222222222222', 'Echo E', 'p.eee.eee', true);
select result, bidder_number,
       bidder_number = (select max(bidder_number) from attendees
                         where event_id = '22222222-2222-2222-2222-222222222222'
                           and id <> '33333333-3333-3333-3333-333333333334') + 1 as is_next
  from check_in_attendee('33333333-3333-3333-3333-333333333334', null, '22222222-2222-2222-2222-222222222222');
select checked_in_by is null as no_staff, checked_in_at is not null as stamped, is_walk_in
  from attendees where id = '33333333-3333-3333-3333-333333333334';
