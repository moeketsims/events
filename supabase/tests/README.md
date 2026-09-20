# Schema verification

Two psql scripts that exercise the migrations against a database. They are not
part of `pnpm test` because they need Postgres; run them after any change to
`supabase/migrations/`.

```bash
supabase start                       # local stack, ports 545xx (see config.toml)
supabase db reset                    # re-apply every migration from scratch
docker exec -i supabase_db_cut-events psql -U postgres -d postgres -q \
  < supabase/tests/00-fixture.sql
docker exec -i supabase_db_cut-events psql -U postgres -d postgres -q \
  < supabase/tests/01-schema-behaviour.sql
docker exec -i supabase_db_cut-events psql -U postgres -d postgres -q -P pager=off \
  < supabase/tests/02-rls-boundaries.sql
```

`01-schema-behaviour.sql` builds its own fixture and walks the auction through
the whole life of a lot: check-in and bidder numbering, every `result` value the
`/api/checkin` and `/api/bid` contracts promise, the soft close extending a lot,
`close_due_lots` settling a winner and marking an under-reserve lot unsold,
`void_bid` rolling the board back, and the ledger staying append-only.

`02-rls-boundaries.sql` assumes each role in turn — `anon`, `door_staff`,
`organiser`, an organiser of a *different* department, and `service_role` — and
reports what each can see and do. Read it as the executable form of the RLS
matrix in BUILD-SPEC §4.5. Every probe runs in its own transaction with
`SET LOCAL ROLE` and a JWT claim, and catches the error, so one denial does not
abort the rest.

The two things that must never regress:

- `anon` returns 0 rows from every table and is refused `lot_state`,
  `place_bid`, `check_in_attendee` and `void_bid` outright.
- No role can `insert into bids` directly, and no role below `service_role` can
  call `place_bid`. That is "one bid path" enforced at the database boundary
  rather than by convention in the application.
