/**
 * Concurrency test for the bid ledger — TASKS T3.4, BUILD-SPEC §12.
 *
 *   pnpm bid-storm                 # 100 bids straight at place_bid()
 *   BID_STORM_HTTP=1 pnpm bid-storm  # through POST /api/bid on a running dev server
 *
 * Twenty checked-in attendees fire a hundred bids at one lot at the same
 * moment, at amounts drawn around the running minimum. Then it asserts what
 * the ledger must never break, whatever order the calls arrived in:
 *
 *   - accepted bids are strictly increasing in time order,
 *   - each accepted bid is at least the previous one plus its own step,
 *   - no two accepted bids share an amount,
 *   - `lot_state.high_bid` is the largest accepted amount,
 *   - `lot_state.bid_count` is the number of accepted bids.
 *
 * Every bid goes through `place_bid`, like every other bid in the platform.
 * Exits non-zero on any failure, so it can gate a release.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import type { Database } from '../lib/db/types';
import { bidStep, formatZAR } from '../lib/money';
import { readIncrementTable } from '../app/(staff)/events/[eventId]/auction/schema';

loadEnv({ path: '.env.local', quiet: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const VIA_HTTP = process.env.BID_STORM_HTTP === '1';

const BIDDERS = 20;
const BIDS = 100;
/** Re-read the minimum this often, so the amounts chase a moving board. */
const REREAD_EVERY = 10;
/** Through HTTP the route allows ten per attendee per ten seconds. */
const HTTP_BIDS_PER_ATTENDEE = 5;

if (!SUPABASE_URL || !SECRET_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local.');
  process.exit(1);
}

type Db = SupabaseClient<Database>;
const db: Db = createClient<Database>(SUPABASE_URL, SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const failures: string[] = [];

function check(condition: boolean, message: string) {
  if (!condition) failures.push(message);
}

function die(what: string, error: { message: string } | null): void {
  if (error) {
    console.error(`\n  ${what} failed: ${error.message}`);
    process.exit(1);
  }
}

/** The seeded auction, its increment table, and the lot with the fewest bids. */
async function target() {
  const { data: auction, error } = await db
    .from('auctions')
    .select('id, event_id, increment_table, soft_close_seconds')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  die('read the auction', error);

  if (!auction) {
    console.error('\n  No auction found. Run `pnpm seed` first.');
    process.exit(1);
  }

  const { data: lots, error: lotError } = await db
    .from('lot_state')
    .select('lot_id, lot_number, title, status, bid_count, closes_at')
    .eq('auction_id', auction.id);
  die('read the lots', lotError);

  const open = (lots ?? []).filter((lot) => lot.status === 'open' && lot.lot_id);
  if (open.length === 0) {
    console.error('\n  No open lots. Open one in the auction editor, or run `pnpm seed`.');
    process.exit(1);
  }

  const lot = open.sort((a, b) => Number(a.bid_count ?? 0) - Number(b.bid_count ?? 0))[0]!;

  // A storm inside the soft-close window would keep pushing the close out and
  // prove nothing about the ledger, so make sure there is room.
  const closesAt = lot.closes_at ? new Date(lot.closes_at).getTime() : null;
  const needed = (auction.soft_close_seconds + 120) * 1000;
  if (closesAt !== null && closesAt - Date.now() < needed) {
    const { error: pushError } = await db
      .from('lots')
      .update({ closes_at: new Date(Date.now() + needed * 2).toISOString() })
      .eq('id', lot.lot_id!);
    die('push the close time out', pushError);
    console.log("  (moved the lot's close time out of the soft-close window for the run)");
  }

  return {
    auctionId: auction.id,
    eventId: auction.event_id,
    lotId: lot.lot_id!,
    lotNumber: lot.lot_number ?? 0,
    title: lot.title ?? '',
    incrementTable: readIncrementTable(auction.increment_table),
  };
}

/** Twenty checked-in attendees, checking more in through the same function the door uses. */
async function bidders(eventId: string) {
  const { data: checkedIn, error } = await db
    .from('attendees')
    .select('id, display_name, bidder_number, pass_token')
    .eq('event_id', eventId)
    .not('checked_in_at', 'is', null)
    .order('bidder_number', { ascending: true })
    .limit(BIDDERS);
  die('read the attendees', error);

  const have = checkedIn ?? [];
  if (have.length >= BIDDERS) return have.slice(0, BIDDERS);

  const { data: waiting, error: waitError } = await db
    .from('attendees')
    .select('id, display_name, pass_token')
    .eq('event_id', eventId)
    .is('checked_in_at', null)
    .limit(BIDDERS - have.length);
  die('read the guests still to arrive', waitError);

  console.log(`  checking in ${waiting?.length ?? 0} more guests to reach ${BIDDERS} bidders`);

  // `p_staff_id` has no default, so it must be named even though the column is
  // nullable: PostgREST resolves an overload by the exact set of argument names.
  const { data: usher } = await db
    .from('profiles')
    .select('id')
    .eq('role', 'door_staff')
    .limit(1)
    .maybeSingle();

  for (const attendee of waiting ?? []) {
    const { error: checkInError } = await db.rpc('check_in_attendee', {
      p_attendee_id: attendee.id,
      p_staff_id: (usher?.id ?? null) as string,
      p_event_id: eventId,
    });
    die(`check in ${attendee.display_name}`, checkInError);
  }

  const { data: again, error: againError } = await db
    .from('attendees')
    .select('id, display_name, bidder_number, pass_token')
    .eq('event_id', eventId)
    .not('checked_in_at', 'is', null)
    .order('bidder_number', { ascending: true })
    .limit(BIDDERS);
  die('re-read the attendees', againError);

  return (again ?? []).slice(0, BIDDERS);
}

type Attempt = {
  attendeeId: string;
  amount: number;
  result: string;
  ms: number;
  status?: number;
};

async function viaRpc(lotId: string, attendeeId: string, amount: number): Promise<Attempt> {
  const started = performance.now();
  const { data, error } = await db.rpc('place_bid', {
    p_lot_id: lotId,
    p_attendee_id: attendeeId,
    p_amount: amount,
  });
  const ms = performance.now() - started;
  if (error) return { attendeeId, amount, result: `error: ${error.message}`, ms };
  const row = Array.isArray(data) ? data[0] : data;
  return { attendeeId, amount, result: row?.result ?? 'no_row', ms };
}

async function viaHttp(
  lotId: string,
  attendeeId: string,
  token: string,
  amount: number,
): Promise<Attempt> {
  const started = performance.now();
  try {
    const response = await fetch(`${APP_URL}/api/bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lotId, amount, token, acceptTerms: true }),
    });
    const ms = performance.now() - started;
    const payload = (await response.json().catch(() => null)) as { result?: string } | null;
    return {
      attendeeId,
      amount,
      result: payload?.result ?? `http_${response.status}`,
      ms,
      status: response.status,
    };
  } catch (error) {
    return {
      attendeeId,
      amount,
      result: error instanceof Error ? `error: ${error.message}` : 'error',
      ms: performance.now() - started,
    };
  }
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index]!;
}

async function currentMin(lotId: string): Promise<number> {
  const { data } = await db.rpc('next_min_bid', { p_lot_id: lotId });
  return Number(data ?? 0);
}

async function main() {
  console.log(
    `\nBid storm — ${VIA_HTTP ? `through ${APP_URL}/api/bid` : 'straight at place_bid()'}\n`,
  );

  const lot = await target();
  const people = await bidders(lot.eventId);

  if (people.length < 2) {
    console.error('\n  Need at least two checked-in attendees. Run `pnpm seed`.');
    process.exit(1);
  }

  const { count: startingCount } = await db
    .from('bids')
    .select('id', { count: 'exact', head: true })
    .eq('lot_id', lot.lotId)
    .is('voided_at', null);

  console.log(`  lot ${lot.lotNumber} — ${lot.title}`);
  console.log(`  ${people.length} bidders, ${startingCount ?? 0} bids already on it`);

  const total = VIA_HTTP ? people.length * HTTP_BIDS_PER_ATTENDEE : BIDS;
  let min = await currentMin(lot.lotId);

  // Amounts are drawn up front, in waves, so that a whole wave is genuinely
  // concurrent: the point is to have many calls contend for the same row.
  const waves: { attendeeId: string; token: string; amount: number }[][] = [];
  for (let placed = 0; placed < total; placed += REREAD_EVERY) {
    const wave: { attendeeId: string; token: string; amount: number }[] = [];
    for (let i = 0; i < REREAD_EVERY && placed + i < total; i += 1) {
      const person = people[(placed + i) % people.length]!;
      const step = bidStep(lot.incrementTable, min);
      // From the minimum to three steps above it: most of a wave is therefore
      // too low by the time it lands, which is exactly the contention wanted.
      const over = Math.floor(Math.random() * 4);
      wave.push({
        attendeeId: person.id,
        token: person.pass_token,
        amount: min + over * step,
      });
    }
    waves.push(wave);
    min = min + bidStep(lot.incrementTable, min) * 2;
  }

  const attempts: Attempt[] = [];
  const started = performance.now();

  for (const wave of waves) {
    const results = await Promise.all(
      wave.map((bid) =>
        VIA_HTTP
          ? viaHttp(lot.lotId, bid.attendeeId, bid.token, bid.amount)
          : viaRpc(lot.lotId, bid.attendeeId, bid.amount),
      ),
    );
    attempts.push(...results);
    // Re-read the real minimum, which the wave has just moved.
    min = await currentMin(lot.lotId);
  }

  const wallMs = performance.now() - started;

  // -------------------------------------------------------------------------
  // What the ledger must look like afterwards
  // -------------------------------------------------------------------------

  const { data: ledger, error: ledgerError } = await db
    .from('bids')
    .select('id, amount, placed_at, attendee_id')
    .eq('lot_id', lot.lotId)
    .is('voided_at', null)
    .order('placed_at', { ascending: true });
  die('read the ledger', ledgerError);

  const rows = (ledger ?? []).map((bid) => ({ ...bid, amount: Number(bid.amount) }));

  let previous: number | null = null;
  const seen = new Set<number>();
  for (const bid of rows) {
    if (previous !== null) {
      check(
        bid.amount > previous,
        `bid ${formatZAR(bid.amount)} at ${bid.placed_at} is not above the one before it (${formatZAR(previous)})`,
      );
      const step = bidStep(lot.incrementTable, previous);
      check(
        bid.amount >= previous + step,
        `bid ${formatZAR(bid.amount)} is less than one step (${formatZAR(step)}) above ${formatZAR(previous)}`,
      );
    }
    check(!seen.has(bid.amount), `two accepted bids at ${formatZAR(bid.amount)}`);
    seen.add(bid.amount);
    previous = bid.amount;
  }

  const { data: state } = await db
    .from('lot_state')
    .select('high_bid, bid_count, high_bidder_number')
    .eq('lot_id', lot.lotId)
    .maybeSingle();

  const highest = rows.length > 0 ? Math.max(...rows.map((bid) => bid.amount)) : null;
  check(
    Number(state?.high_bid ?? 0) === (highest ?? 0),
    `lot_state.high_bid is ${formatZAR(Number(state?.high_bid ?? 0))}, the ledger's highest is ${formatZAR(highest)}`,
  );
  check(
    Number(state?.bid_count ?? 0) === rows.length,
    `lot_state.bid_count is ${state?.bid_count}, the ledger holds ${rows.length}`,
  );

  const accepted = attempts.filter((attempt) => attempt.result === 'ok');
  check(
    rows.length === (startingCount ?? 0) + accepted.length,
    `${accepted.length} bids were accepted but the ledger grew by ${rows.length - (startingCount ?? 0)}`,
  );

  // -------------------------------------------------------------------------
  // Report
  // -------------------------------------------------------------------------

  const histogram = new Map<string, number>();
  for (const attempt of attempts) {
    histogram.set(attempt.result, (histogram.get(attempt.result) ?? 0) + 1);
  }

  const times = attempts.map((attempt) => attempt.ms);

  console.log(`\n  ${attempts.length} bids fired, ${accepted.length} accepted\n`);
  for (const [result, count] of [...histogram].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(count).padStart(4)}  ${result}`);
  }
  console.log(`\n  wall time   ${(wallMs / 1000).toFixed(2)} s`);
  console.log(`  p50         ${percentile(times, 50).toFixed(0)} ms`);
  console.log(`  p95         ${percentile(times, 95).toFixed(0)} ms`);
  console.log(
    `  high bid    ${formatZAR(Number(state?.high_bid ?? 0))} by bidder ${state?.high_bidder_number ?? '—'}`,
  );
  console.log(`  ledger      ${rows.length} live bids on the lot`);

  if (VIA_HTTP) {
    // The waves above stay inside the limit on purpose, so they measure the
    // ledger rather than the limiter. This proves the limiter itself: one
    // attendee, twelve bids with no pause, of which at least two must be
    // refused with 429.
    const one = people[0]!;
    const burst = await Promise.all(
      Array.from({ length: 12 }, () => viaHttp(lot.lotId, one.id, one.pass_token, 1)),
    );
    const limited = burst.filter((attempt) => attempt.status === 429).length;
    console.log(`
  burst of 12 from one bidder: ${limited} refused with 429`);
    check(
      limited >= 2,
      `a burst of twelve bids from one attendee was rate limited ${limited} times; expected at least two`,
    );
  }

  if (failures.length > 0) {
    console.error(
      `\n  FAILED — ${failures.length} assertion${failures.length === 1 ? '' : 's'}:\n`,
    );
    for (const failure of failures.slice(0, 20)) console.error(`    ${failure}`);
    process.exit(1);
  }

  console.log(
    '\n  The ledger is strictly increasing, in valid steps, with no duplicates. Passed.\n',
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
