/**
 * Record the "bidding, live" clip — docs/08, Act 3.
 *
 *   pnpm exec tsx scripts/record-bidding.mts
 *
 * A guest bids from their pass, then the projection board is shown reacting to
 * bids as they land. The later bids are placed from this script through the
 * `place_bid` function — the same one the phone calls, and the only way a bid
 * can enter the ledger — so the board really is reacting to live traffic
 * rather than to anything staged in the page.
 *
 * Runs against the seeded Gala, which is the only event with lots and bids.
 * It borrows one lot's closing time for the length of the take so the board
 * shows a counting clock, and puts it back afterwards.
 *
 * Output: recordings/cut-events-bidding.mp4
 */
import { chromium, type BrowserContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import {
  caption,
  encodeForWhatsApp,
  ensureOverlay,
  goto,
  hideCaption,
  pointAndClick,
  setStep,
  showCard,
  smoothScroll,
  startClock,
  trimmedBeats,
} from './lib/record-ui.mts';

const SITE = process.env.SITE ?? 'https://cut-events.vercel.app';
const OUT_DIR = 'recordings';
const RAW_DIR = `${OUT_DIR}/raw-bidding`;
const FINAL = `${OUT_DIR}/cut-events-bidding.mp4`;

function readEnv(file: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(file, 'utf8')
        .split('\n')
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
    );
  } catch {
    return {};
  }
}

const env = readEnv('.deploy/secrets.env');
if (!env.SUPABASE_PROJECT_REF || !env.SUPABASE_SECRET_KEY) {
  console.error('Missing SUPABASE_PROJECT_REF or SUPABASE_SECRET_KEY in .deploy/secrets.env');
  process.exit(1);
}

const db = createClient(
  `https://${env.SUPABASE_PROJECT_REF}.supabase.co`,
  env.SUPABASE_SECRET_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
);

// --- What this clip needs -------------------------------------------------

const { data: auction } = await db
  .from('auctions')
  .select('id, display_key, event_id, title')
  .limit(1)
  .maybeSingle();

if (!auction) {
  console.error('No auction on the project. Run scripts/reseed-hosted.sh first.');
  process.exit(1);
}

const { data: lots } = await db
  .from('lots')
  .select('id, lot_number, title, closes_at, status')
  .eq('auction_id', auction.id)
  .eq('status', 'open')
  .order('lot_number', { ascending: true });

if (!lots || lots.length < 2) {
  console.error('Need at least two open lots. Run scripts/reseed-hosted.sh first.');
  process.exit(1);
}

const heroLot = lots[0]!;
const otherLot = lots[1]!;

const { data: bidders } = await db
  .from('attendees')
  .select('id, pass_token, bidder_number')
  .eq('event_id', auction.event_id)
  .not('bidder_number', 'is', null)
  .not('pass_token', 'is', null)
  .order('bidder_number', { ascending: true })
  .limit(6);

if (!bidders || bidders.length < 4) {
  console.error('Need at least four checked-in guests. Run scripts/reseed-hosted.sh first.');
  process.exit(1);
}

// The guest whose phone we film must be someone who has not bid yet, so the
// clip shows the auction terms being accepted — that happens once, on a
// guest's first bid — and so their screen carries no leftover outbid notice.
const { data: alreadyBid } = await db
  .from('bids')
  .select('attendee_id, lots!inner(auction_id)')
  .eq('lots.auction_id', auction.id)
  .is('voided_at', null);
const hasBid = new Set((alreadyBid ?? []).map((b) => b.attendee_id));

let guest = bidders.find((b) => !hasBid.has(b.id));

// Everyone in the room has bid already, which happens after a few takes. Bring
// one more guest through the door, exactly as the evening would.
if (!guest) {
  const { data: waiting } = await db
    .from('attendees')
    .select('id, pass_token')
    .eq('event_id', auction.event_id)
    .is('checked_in_at', null)
    .not('pass_token', 'is', null)
    .limit(1)
    .maybeSingle();

  if (!waiting) {
    console.error('Nobody left to check in. Run scripts/reseed-hosted.sh first.');
    process.exit(1);
  }

  const { data: arrival, error: arrivalError } = await db.rpc('check_in_attendee', {
    p_attendee_id: waiting.id,
    p_staff_id: null as unknown as string,
    p_event_id: auction.event_id,
  });
  const row = Array.isArray(arrival) ? arrival[0] : arrival;
  if (arrivalError || !row) {
    console.error(`Could not check a guest in: ${arrivalError?.message}`);
    process.exit(1);
  }
  guest = { id: waiting.id, pass_token: waiting.pass_token, bidder_number: row.bidder_number };
  console.log('  checked a waiting guest in, so someone in the room has not bid yet');
}
console.log(
  `  filming Bidder ${String(guest.bidder_number).padStart(3, '0')}, who has not bid yet`,
);

// They bid on the lot the board is not watching, so the hero lot is still free
// to move while the camera is on it.
const rivals = bidders.filter((b) => b.id !== guest.id);

/** The lowest bid the database will accept on a lot right now. */
async function nextMin(lotId: string): Promise<number> {
  const { data } = await db.rpc('next_min_bid', { p_lot_id: lotId });
  return Number(data ?? 0);
}

/** A bid from the floor, through the one function that can write to the ledger. */
async function bidFromTheFloor(lotId: string, attendeeId: string): Promise<void> {
  const amount = await nextMin(lotId);
  const { data, error } = await db.rpc('place_bid', {
    p_lot_id: lotId,
    p_attendee_id: attendeeId,
    p_amount: amount,
  });
  const row = Array.isArray(data) ? data[0] : data;
  console.log(`    bid R${amount}: ${error ? error.message : (row?.result ?? 'ok')}`);
}

// Borrow a closing time so the board shows a clock counting down, and note the
// original so it can be put back however this run ends.
const originalClosesAt = heroLot.closes_at;
const borrowed = new Date(Date.now() + 8 * 60 * 1000).toISOString();
await db.from('lots').update({ closes_at: borrowed }).eq('id', heroLot.id);
console.log(`  lot ${heroLot.lot_number} closes in 8 minutes for the take`);

async function restoreLot(): Promise<void> {
  await db.from('lots').update({ closes_at: originalClosesAt }).eq('id', heroLot.id);
  console.log('  closing time restored');
}

// --- Record ---------------------------------------------------------------

rmSync(RAW_DIR, { recursive: true, force: true });
mkdirSync(RAW_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx: BrowserContext = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: RAW_DIR, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
startClock();

try {
  await showCard(
    page,
    [
      'Bidding, live',
      'CUT Events · Institutional Advancement',
      'A phone in the room, and the board on the wall.',
    ],
    4200,
    true,
    'Bidding, live. A phone in the room, and the board on the wall.',
    true,
  );

  // --- 1. A guest bids from their pass ------------------------------------
  await setStep(page, 1, 'From a guest’s phone');
  await goto(page, `${SITE}/p/${guest.pass_token}/auction/${otherLot.id}`);
  await caption(page, 'A guest opens a lot from the pass already on their phone.', 3400);

  // The lot's photograph fills the first screen; the money is under it, and the
  // money is what these captions are about.
  await smoothScroll(page, 300, 1200);
  await caption(page, 'The lot, what it stands at, and the least the next bid may be.', 4000);
  await smoothScroll(page, 620, 1200);
  await caption(page, 'Every bid so far, by number. The room never sees a name.', 4000);

  const bidButton = page.getByRole('button', { name: /^Bid R/ }).first();
  await caption(page, 'One button, already filled in with the smallest bid it will take.', 4200);
  await pointAndClick(page, bidButton, 1800);

  // The terms are accepted once, on a guest's first bid of the evening.
  const agree = page.getByRole('button', { name: /I agree and place my bid/i });
  if ((await agree.count()) > 0) {
    await caption(page, 'On a first bid, the auction terms are shown and recorded.', 3800);
    await pointAndClick(page, agree, 2600);
  }
  await ensureOverlay(page);
  await smoothScroll(page, 320, 1100);
  await caption(page, 'Placed. They are leading, and it is in the ledger.', 4000);
  await caption(page, 'The minimum just moved up, and so did the next bid on offer.', 3800);

  // --- 2. The board -------------------------------------------------------
  await setStep(page, 2, 'The board in the room');
  await goto(page, `${SITE}/display/${auction.id}?k=${auction.display_key}`);
  await caption(page, 'This is the projection, on the wall of the venue.', 3600);
  await caption(page, 'Six lots, the money on each, and the clock.', 3400);
  await hideCaption(page);
  await page.waitForTimeout(1600);

  // --- 3. Bids land while the camera is on it -----------------------------
  await setStep(page, 3, 'Watch it move');
  await caption(page, 'Now three guests bid from their phones, around the room.', 3800);
  await hideCaption(page);

  for (const [i, rival] of rivals.slice(0, 3).entries()) {
    await bidFromTheFloor(i === 1 ? otherLot.id : heroLot.id, rival.id);
    await page.waitForTimeout(4200);
  }

  await caption(page, 'Under a second each, with the card flashing as it lands.', 4000);
  await hideCaption(page);
  await page.waitForTimeout(2200);

  // --- 4. Anonymity -------------------------------------------------------
  await setStep(page, 4, 'Numbers, never names');
  await caption(page, 'Nowhere on that wall is anybody’s name.', 3600);
  await caption(page, 'The room sees bidder numbers. Only an organiser can look behind one.', 4400);
  await caption(page, 'And when they do, the database writes down that they did.', 4000);
  await hideCaption(page);
  await page.waitForTimeout(1800);

  await showCard(
    page,
    [
      'No paddles, no paperwork.',
      'Every bid is binding, time-stamped and anonymous in the room.',
      'cut-events.vercel.app',
    ],
    3600,
    false,
    'No paddles, and no paperwork. Every bid is binding and time-stamped.',
  );
} finally {
  await restoreLot();
}

await ctx.close();
const raw = await page.video()?.path();
await browser.close();

if (!raw || !existsSync(raw)) {
  console.error('No video was produced.');
  process.exit(1);
}

console.log('  encoding for WhatsApp…');
encodeForWhatsApp(raw, FINAL);

writeFileSync(`${OUT_DIR}/narration-bidding.json`, JSON.stringify(trimmedBeats(), null, 2));

const mb = (statSync(FINAL).size / 1024 / 1024).toFixed(1);
console.log(`\n  ${FINAL}  (${mb} MB)\n`);
