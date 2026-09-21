/**
 * Record the "at the door" clip — docs/08.
 *
 *   pnpm exec tsx scripts/record-door.mts
 *
 * The three ways a guest gets into the room: a pass scanned with the camera,
 * a name found in the list, and someone who was never invited registered on
 * the spot. Then the register they all land on, and the export.
 *
 * The camera scan itself is not filmed here. html5-qrcode cannot run in a
 * headless browser — it throws and takes the page down with it — so the clip
 * shows the scanner and says plainly that the scan is filmed on the night.
 *
 * Output: recordings/cut-events-door.mp4
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
  setStep,
  showCard,
  smoothScroll,
  startClock,
  trimmedBeats,
} from './lib/record-ui.mts';

const SITE = process.env.SITE ?? 'https://cut-events.vercel.app';
const STAFF = 'organiser@demo.cut-events.test';
const OUT_DIR = 'recordings';
const RAW_DIR = `${OUT_DIR}/raw-door`;
const FINAL = `${OUT_DIR}/cut-events-door.mp4`;

const WALK_IN = {
  first: 'Themba',
  last: 'Radebe',
  email: 'themba.radebe@example.com',
  phone: '082 123 4567',
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

// --- The event with a room full of people ---------------------------------

const { data: event } = await db
  .from('events')
  .select('id, title')
  .ilike('title', '%Gala%')
  .maybeSingle();

if (!event) {
  console.error('No Gala event. Run scripts/reseed-hosted.sh first.');
  process.exit(1);
}

/** Two guests still outside, one of whom we find by name. */
const { data: waiting } = await db
  .from('attendees')
  .select('id, display_name, pass_token')
  .eq('event_id', event.id)
  .is('checked_in_at', null)
  .not('pass_token', 'is', null)
  // Plus-ones are called "Guest of ...", which makes a poor thing to search for.
  .not('display_name', 'ilike', 'Guest of%')
  .limit(2);

if (!waiting || waiting.length < 2) {
  console.error('Fewer than two guests still to arrive. Run scripts/reseed-hosted.sh first.');
  process.exit(1);
}

const toSearch = waiting[1]!;
const searchTerm = (toSearch.display_name ?? '').split(' ')[0] ?? '';

// The walk-in must be a stranger, or the route matches an existing contact.
const { data: priorContact } = await db
  .from('contacts')
  .select('id')
  .eq('email', WALK_IN.email)
  .maybeSingle();
if (priorContact) {
  const { data: theirAttendees } = await db
    .from('attendees')
    .select('id')
    .eq('contact_id', priorContact.id);
  const ids = (theirAttendees ?? []).map((a) => a.id);
  if (ids.length) await db.from('attendees').delete().in('id', ids);
  await db.from('consents').delete().eq('contact_id', priorContact.id);
  await db.from('contacts').delete().eq('id', priorContact.id);
}

console.log(`  searching for ${searchTerm}`);

// --- A camera that sees a real pass ---------------------------------------

rmSync(RAW_DIR, { recursive: true, force: true });
mkdirSync(RAW_DIR, { recursive: true });

// --- Sign in and record ---------------------------------------------------

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
  permissions: ['camera'],
});
await ctx.addCookies(cookies);
const page = await ctx.newPage();
startClock();

await showCard(
  page,
  ['At the door', 'CUT Events · Institutional Advancement', 'Three ways into the room.'],
  4200,
  true,
  'At the door. Three ways into the room.',
  true,
);

const scanUrl = `${SITE}/scan/${event.id}`;
const eventUrl = `${SITE}/events/${event.id}`;

// --- 1. Scan a pass -------------------------------------------------------
await goto(page, scanUrl);
await setStep(page, 1, 'Scan a pass');
await caption(page, 'This is what an usher holds. No extra hardware, just a phone.', 4000);
await caption(page, 'The camera reads the code on a guest’s pass and checks them in.', 4000);
await caption(page, 'That part needs a real phone camera, so it is filmed on the night.', 4200);
await caption(page, 'Everything else at the door works without one.', 3400);

// --- 2. Find them by name -------------------------------------------------
await setStep(page, 2, 'Or find them by name');
const searchTab = page.getByRole('button', { name: 'Search', exact: true }).first();
if ((await searchTab.count()) > 0) {
  await caption(page, 'A flat battery or a forgotten link is not a problem.', 3800);
  await pointAndClick(page, searchTab, 1400);
  await ensureOverlay(page);
  const field = page.locator('input[placeholder="Guest name"]').first();
  if ((await field.count()) > 0) {
    await pointAndType(page, field, searchTerm, 90);
    await page.waitForTimeout(1800);
    await ensureOverlay(page);
    await caption(page, 'Find them in the list and check them in by hand.', 3600);
    const checkIn = page.getByRole('button', { name: /^Check in$/i }).first();
    if ((await checkIn.count()) > 0) {
      await pointAndClick(page, checkIn, 3200);
      await ensureOverlay(page);
      await caption(page, 'Same result, same record.', 3000);
    }
  }
}

// --- 3. Someone who was never invited -------------------------------------
await setStep(page, 3, 'A guest who is not on the list');
const walkTab = page.getByRole('button', { name: 'Walk-in', exact: true }).first();
if ((await walkTab.count()) > 0) {
  await caption(page, 'And the guest nobody expected, who has come anyway.', 3800);
  await pointAndClick(page, walkTab, 1400);
  await ensureOverlay(page);
  await pointAndType(page, page.locator('input[name="firstName"]').first(), WALK_IN.first, 60);
  await pointAndType(page, page.locator('input[name="lastName"]').first(), WALK_IN.last, 55);
  await pointAndType(page, page.locator('input[name="email"]').first(), WALK_IN.email, 30);
  await pointAndType(page, page.locator('input[name="phone"]').first(), WALK_IN.phone, 45);
  await caption(page, 'Five fields, and the consent the law requires before we keep them.', 4400);
  const consent = page.locator('input[name="consent"]').first();
  if ((await consent.count()) > 0) await pointAndClick(page, consent, 700);
  const register = page.getByRole('button', { name: /Register and check in/i }).first();
  if ((await register.count()) > 0) {
    await pointAndClick(page, register, 1200);
    await ensureOverlay(page);
    await caption(page, 'Registered, checked in, and given a bidder number in one go.', 3200);
  }
}

// --- 4. The register ------------------------------------------------------
await setStep(page, 4, 'The register');
await goto(page, `${eventUrl}/attendance`);
await caption(page, 'Every arrival, however they came in, lands on one list.', 4000);
await smoothScroll(page, 420);
await caption(page, 'Who is here, who is still to come, and who let them in.', 4000);
await smoothScroll(page, 0);
const exportButton = page.getByRole('link', { name: /Export CSV/i }).first();
if ((await exportButton.count()) > 0) {
  await caption(page, 'And it leaves as a spreadsheet whenever Finance asks.', 3800);
}
await hideCaption(page);
await page.waitForTimeout(1800);

await showCard(
  page,
  [
    'No clipboard, no queue.',
    'Scanned, searched or registered on the spot — one live register either way.',
    'cut-events.vercel.app',
  ],
  3600,
  false,
  'No clipboard and no queue, whichever way a guest arrives.',
);

await ctx.close();
const raw = await page.video()?.path();
await browser.close();

if (!raw || !existsSync(raw)) {
  console.error('No video was produced.');
  process.exit(1);
}

console.log('  encoding for WhatsApp…');
encodeForWhatsApp(raw, FINAL);
writeFileSync(`${OUT_DIR}/narration-door.json`, JSON.stringify(trimmedBeats(), null, 2));

const mb = (statSync(FINAL).size / 1024 / 1024).toFixed(1);
console.log(`\n  ${FINAL}  (${mb} MB)\n`);
