/**
 * Record the "the close" clip — docs/08.
 *
 *   pnpm exec tsx scripts/record-close.mts
 *
 * The end of a silent auction, which is where most of them go wrong: a
 * countdown running out, a late bid buying everyone two more minutes, the lot
 * settling on its winner, and a lot that never met its reserve going unsold.
 *
 * Nothing is faked. The clip borrows two of the seeded Gala's lots, moves their
 * closing times into the next two minutes, lets `place_bid` and `close_due_lots`
 * do exactly what they do on the night, and puts both lots back afterwards.
 *
 * Output: recordings/cut-events-close.mp4
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
const RAW_DIR = `${OUT_DIR}/raw-close`;
const FINAL = `${OUT_DIR}/cut-events-close.mp4`;

/** Seconds left on the clock when the camera arrives. Inside the soft-close window. */
const SECONDS_LEFT = 100;

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

const { data: event } = await db.from('events').select('id').ilike('title', '%Gala%').maybeSingle();
if (!event) {
  console.error('No Gala event. Run scripts/reseed-hosted.sh first.');
  process.exit(1);
}

const { data: auction } = await db
  .from('auctions')
  .select('id, display_key')
  .eq('event_id', event.id)
  .maybeSingle();
if (!auction) {
  console.error('The Gala has no auction. Run scripts/reseed-hosted.sh first.');
  process.exit(1);
}

const { data: board } = await db
  .from('lot_state')
  .select('lot_id, lot_number, title, status, high_bid, reserve')
  .eq('auction_id', auction.id)
  .order('lot_number');

const open = (board ?? []).filter((l) => l.status === 'open');
/** A lot that will sell: no reserve standing in the way. */
const winnerLot = open.find((l) => l.reserve === null);
/** A lot whose best bid is still under its reserve, which must go unsold. */
const unsoldLot = open.find(
  (l) => l.reserve !== null && Number(l.high_bid ?? 0) < Number(l.reserve),
);

if (!winnerLot || !unsoldLot) {
  console.error('Need one open lot without a reserve and one under its reserve.');
  process.exit(1);
}

const { data: guest } = await db
  .from('attendees')
  .select('id, display_name, bidder_number, pass_token')
  .eq('event_id', event.id)
  .not('checked_in_at', 'is', null)
  .not('pass_token', 'is', null)
  .not('display_name', 'ilike', 'Guest of%')
  .order('bidder_number', { ascending: false })
  .limit(1)
  .maybeSingle();

if (!guest) {
  console.error('Nobody is checked in. Run scripts/record-door.mts first.');
  process.exit(1);
}

// What to put back, however this run ends.
const { data: originals } = await db
  .from('lots')
  .select('id, closes_at, status')
  .in('id', [winnerLot.lot_id!, unsoldLot.lot_id!]);

async function restoreLots(): Promise<void> {
  for (const lot of originals ?? []) {
    await db.from('lots').update({ closes_at: lot.closes_at, status: lot.status }).eq('id', lot.id);
  }
  await db.from('settlements').delete().in('lot_id', [winnerLot!.lot_id!, unsoldLot!.lot_id!]);
  console.log('  lots put back as they were');
}

const closesAt = new Date(Date.now() + SECONDS_LEFT * 1000).toISOString();
await db.from('lots').update({ closes_at: closesAt }).eq('id', winnerLot.lot_id!);
console.log(
  `  lot ${winnerLot.lot_number} closes in ${SECONDS_LEFT}s; ` +
    `lot ${unsoldLot.lot_number} is R${unsoldLot.high_bid} against a R${unsoldLot.reserve} reserve`,
);

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
      'The close',
      'CUT Events · Institutional Advancement',
      'Where a silent auction is usually lost.',
    ],
    4200,
    true,
    'The close, which is where a silent auction is usually lost.',
    true,
  );

  const lotUrl = `${SITE}/p/${guest.pass_token}/auction/${winnerLot.lot_id}`;

  // --- 1. The clock -------------------------------------------------------
  await goto(page, lotUrl);
  await setStep(page, 1, 'Under two minutes');
  await smoothScroll(page, 300, 1200);
  await caption(page, 'Under two minutes left, and the clock turns gold.', 4000);
  await caption(page, 'This is the moment paper auctions are decided by whoever shouts.', 4400);

  // --- 2. A late bid ------------------------------------------------------
  await setStep(page, 2, 'A late bid');
  const bidButton = page.getByRole('button', { name: /^Bid R/ }).first();
  if ((await bidButton.count()) > 0) {
    await pointAndClick(page, bidButton, 1600);
    const agree = page.getByRole('button', { name: /I agree and place my bid/i });
    if ((await agree.count()) > 0) await pointAndClick(page, agree, 2400);
    await ensureOverlay(page);
    await caption(page, 'A bid this late does not just take the lead.', 3600);
    await caption(page, 'It pushes the close back out, so nobody wins by sniping.', 4400);
    await caption(page, 'Everyone in the room gets two more minutes to answer.', 4000);
  }

  // --- 3. Time up ---------------------------------------------------------
  await setStep(page, 3, 'Time up');
  await caption(page, 'When the clock does run out, the lot settles itself.', 3800);
  await db
    .from('lots')
    .update({ closes_at: new Date(Date.now() - 1000).toISOString() })
    .eq('id', winnerLot.lot_id!);
  await db
    .from('lots')
    .update({ closes_at: new Date(Date.now() - 1000).toISOString() })
    .eq('id', unsoldLot.lot_id!);
  const { data: closed } = await db.rpc('close_due_lots');
  console.log(`  close_due_lots settled ${closed ?? 0} lot(s)`);

  await page.waitForTimeout(3200);
  if (!(await page.getByText(/Bidding closed|Sold to/i).count())) {
    await page.reload({ waitUntil: 'networkidle' });
    await ensureOverlay(page);
  }
  await smoothScroll(page, 300, 1000);
  await caption(page, 'Closed, settled, and the winner told on their own screen.', 4200);
  await caption(page, 'No auctioneer, no clipboard, and nothing to reconcile afterwards.', 4400);

  // --- 4. Under reserve ---------------------------------------------------
  await setStep(page, 4, 'Under the reserve');
  // Straight to that lot, rather than a scroll position that may land on its
  // neighbour: the caption has to be about what is on screen.
  await goto(page, `${SITE}/p/${guest.pass_token}/auction/${unsoldLot.lot_id}`);
  await smoothScroll(page, 300, 1200);
  await caption(page, 'And the lot whose best bid never reached its reserve.', 4200);
  await caption(page, 'It closes unsold. The donor keeps it, and nobody is embarrassed.', 4400);
  await caption(page, 'The room was never told what the reserve was.', 3800);

  // --- 5. What the winner sees -------------------------------------------
  await setStep(page, 5, 'What the winner sees');
  await goto(page, `${SITE}/p/${guest.pass_token}/bids`);
  await caption(page, 'Every lot they bid on, and the one they have won.', 4000);
  await caption(page, 'With what is owed, ready for the payment link to follow.', 4200);
  await hideCaption(page);
  await page.waitForTimeout(2000);

  await showCard(
    page,
    [
      'It closes itself.',
      'A soft close nobody can snipe, a settled winner, and a reserve that holds.',
      'cut-events.vercel.app',
    ],
    3600,
    false,
    'It closes itself: a soft close nobody can snipe, and a reserve that holds.',
  );
} finally {
  await restoreLots();
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
writeFileSync(`${OUT_DIR}/narration-close.json`, JSON.stringify(trimmedBeats(), null, 2));

const mb = (statSync(FINAL).size / 1024 / 1024).toFixed(1);
console.log(`\n  ${FINAL}  (${mb} MB)\n`);
