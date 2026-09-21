/**
 * Record the "building the auction" clip — docs/08.
 *
 *   pnpm exec tsx scripts/record-auction.mts
 *
 * Turning a silent auction on for an event that has none, setting the rules
 * that decide what a valid bid is, adding a lot, and picking up the link the
 * projector opens.
 *
 * Runs on the CUT Alumni Homecoming rather than the seeded Gala, because the
 * Gala already has an auction and six lots; here the whole thing is built from
 * nothing on camera. The auction and its lots are cleared first so the clip is
 * repeatable.
 *
 * Output: recordings/cut-events-auction.mp4
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
  pointAndType,
  ring,
  setStep,
  showCard,
  smoothScroll,
  startClock,
  trimmedBeats,
} from './lib/record-ui.mts';

const SITE = process.env.SITE ?? 'https://cut-events.vercel.app';
const STAFF = 'organiser@demo.cut-events.test';
const OUT_DIR = 'recordings';
const RAW_DIR = `${OUT_DIR}/raw-auction`;
const FINAL = `${OUT_DIR}/cut-events-auction.mp4`;
const EVENT_TITLE = 'CUT Alumni Homecoming';

const LOT = {
  title: 'A week at a Drakensberg cottage',
  description:
    'Seven nights for six, with the mountain on the doorstep. Valid for twelve months, ' +
    'outside school holidays.',
  donor: 'The Botha family',
  startingBid: '4000',
  reserve: '6000',
};

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

const { data: event } = await db.from('events').select('id').eq('title', EVENT_TITLE).maybeSingle();

if (!event) {
  console.error(`No "${EVENT_TITLE}" event. Run scripts/record-setup.mts first.`);
  process.exit(1);
}
const eventId = event.id;

// Clear any auction from an earlier take, so this one is built from nothing.
const { data: priorAuctions } = await db.from('auctions').select('id').eq('event_id', eventId);
const auctionIds = (priorAuctions ?? []).map((a) => a.id);
if (auctionIds.length) {
  const { data: lots } = await db.from('lots').select('id').in('auction_id', auctionIds);
  const lotIds = (lots ?? []).map((l) => l.id);
  if (lotIds.length) {
    await db.from('bids').delete().in('lot_id', lotIds);
    await db.from('settlements').delete().in('lot_id', lotIds);
    await db.from('lots').delete().in('id', lotIds);
  }
  await db.from('auctions').delete().in('id', auctionIds);
  console.log(`  cleared ${auctionIds.length} auction(s) from an earlier take`);
}
await db.from('events').update({ auction_enabled: true, status: 'published' }).eq('id', eventId);

console.log('  minting a one-time sign-in link…');
const { data: link, error: linkError } = await db.auth.admin.generateLink({
  type: 'magiclink',
  email: STAFF,
});
if (linkError || !link.properties?.hashed_token) {
  console.error(`Could not mint a sign-in link: ${linkError?.message}`);
  process.exit(1);
}
const signInUrl = `${SITE}/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink&next=/dashboard`;

rmSync(RAW_DIR, { recursive: true, force: true });
mkdirSync(RAW_DIR, { recursive: true });

const browser = await chromium.launch();

console.log('  signing in (not recorded)…');
const auth = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const authPage = await auth.newPage();
await authPage.goto(signInUrl, { waitUntil: 'networkidle' });
await authPage.waitForURL(/\/dashboard/, { timeout: 45_000 });
const cookies = (await auth.storageState()).cookies;
await auth.close();

console.log('  recording…');
const ctx: BrowserContext = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: RAW_DIR, size: { width: 1280, height: 720 } },
});
await ctx.addCookies(cookies);
const page = await ctx.newPage();
startClock();

await showCard(
  page,
  [
    'Building the auction',
    'CUT Events · Institutional Advancement',
    'The rules, the lots, and the screen on the wall.',
  ],
  4200,
  true,
  'Building the auction: the rules, the lots, and the screen on the wall.',
  true,
);

const auctionUrl = `${SITE}/events/${eventId}/auction`;

// --- 1. Turn it on --------------------------------------------------------
await goto(page, auctionUrl);
await setStep(page, 1, 'Turn it on');
await caption(page, 'An event can run a silent auction alongside the dinner.', 3600);
const enable = page.getByRole('button', { name: /Enable the silent auction/i }).first();
if ((await enable.count()) > 0) {
  await pointAndClick(page, enable, 3000);
  await ensureOverlay(page);
  await caption(page, 'That is the auction itself created, with nothing in it yet.', 3800);
}

// --- 2. The rules ---------------------------------------------------------
await setStep(page, 2, 'Set the rules');
await caption(page, 'These settings decide what counts as a valid bid.', 3600);

const title = page.locator('#auction-title').first();
if ((await title.count()) > 0) {
  await title.fill('');
  await pointAndType(page, title, 'CUT Homecoming Silent Auction', 34);
}

const soft = page.locator('#auction-soft').first();
if ((await soft.count()) > 0) {
  await ring(page, soft);
  await soft.fill('120');
  await page.waitForTimeout(800);
  await ring(page, null);
  await caption(page, 'A bid in the last two minutes pushes the close out by two more.', 4400);
  await caption(page, 'Nobody wins a lot by being the quickest thumb at the buzzer.', 4000);
}

await smoothScroll(page, 420);
await caption(page, 'And the increments: how much a bid has to rise, by price band.', 4400);
await caption(page, 'The phone, the board and the database all use this one table.', 4200);

const saveSettings = page.getByRole('button', { name: /Save settings/i }).first();
if ((await saveSettings.count()) > 0) {
  await pointAndClick(page, saveSettings, 2800);
  await ensureOverlay(page);
}

// --- 3. A lot -------------------------------------------------------------
await setStep(page, 3, 'Add a lot');
await smoothScroll(page, 780);
const addLot = page.getByRole('button', { name: /^Add a lot$/i }).first();
if ((await addLot.count()) > 0) {
  await caption(page, 'Now the things people are actually bidding on.', 3200);
  await pointAndClick(page, addLot, 1800);
  await ensureOverlay(page);

  await pointAndType(page, page.locator('#lot-title').first(), LOT.title, 34);
  await pointAndType(page, page.locator('#lot-description').first(), LOT.description, 16);
  await pointAndType(page, page.locator('#lot-donor').first(), LOT.donor, 40);
  await caption(page, 'The donor is credited, which is half the reason they gave it.', 4000);

  const starting = page.locator('#lot-starting').first();
  if ((await starting.count()) > 0) {
    await ring(page, starting);
    await starting.fill(LOT.startingBid);
    await page.waitForTimeout(700);
    await ring(page, null);
  }
  const reserve = page.locator('#lot-reserve').first();
  if ((await reserve.count()) > 0) {
    await ring(page, reserve);
    await reserve.fill(LOT.reserve);
    await page.waitForTimeout(700);
    await ring(page, null);
    await caption(page, 'A reserve the room never sees. Under it, the lot goes unsold.', 4400);
  }

  // The button says "Create lot" while the lot is new and "Save lot" once it
  // exists; saving then reveals the photographs step rather than closing.
  const saveLot = page.getByRole('button', { name: /Create lot|Save lot/i }).first();
  if ((await saveLot.count()) > 0) {
    await pointAndClick(page, saveLot, 3000);
    await ensureOverlay(page);
    await caption(page, 'Saved, and now it asks for the photographs.', 3600);
    await caption(page, 'The first one becomes the lot’s card on the board.', 3800);
    const close = page.getByRole('button', { name: /^Close$/i }).first();
    if ((await close.count()) > 0) {
      await pointAndClick(page, close, 2400);
      await ensureOverlay(page);
    }
    // The catalogue sits near the top of the page, not down by the settings.
    await smoothScroll(page, 200, 1200);
    await caption(page, 'Lot one, on the catalogue and ready to open.', 4000);
  }
}

// --- 4. The projection link ----------------------------------------------
await setStep(page, 4, 'The screen on the wall');
await smoothScroll(page, 1200);
await caption(page, 'And the link the projector opens, which is its only key.', 4200);
await caption(page, 'Rotate it and a screen someone walked off with goes dark.', 4200);
await hideCaption(page);
await page.waitForTimeout(1800);

await showCard(
  page,
  [
    'Set up once, before the doors open.',
    'The rules, the catalogue and the board, ready for the room.',
    'cut-events.vercel.app',
  ],
  3600,
  false,
  'Set up once before the doors open: the rules, the catalogue and the board.',
);

await ctx.close();
const raw = await page.video()?.path();
await browser.close();

if (!raw || !existsSync(raw)) {
  console.error('No video was produced.');
  process.exit(1);
}

const { data: built } = await db
  .from('auctions')
  .select('id, title, soft_close_seconds')
  .eq('event_id', eventId)
  .maybeSingle();
const { count: lotCount } = await db
  .from('lots')
  .select('id', { count: 'exact', head: true })
  .eq('auction_id', built?.id ?? '00000000-0000-0000-0000-000000000000');
console.log(
  built
    ? `  built "${built.title}", soft close ${built.soft_close_seconds}s, ${lotCount ?? 0} lot(s)`
    : '  WARNING: no auction exists after the take',
);

console.log('  encoding for WhatsApp…');
encodeForWhatsApp(raw, FINAL);
writeFileSync(`${OUT_DIR}/narration-auction.json`, JSON.stringify(trimmedBeats(), null, 2));

const mb = (statSync(FINAL).size / 1024 / 1024).toFixed(1);
console.log(`\n  ${FINAL}  (${mb} MB)\n`);
