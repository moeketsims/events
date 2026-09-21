/**
 * Record the "guests check themselves in" clip — docs/08, Act 2.
 *
 *   pnpm exec tsx scripts/record-checkin.mts
 *
 * Picks up where scripts/record-setup.mts left off: the same event, now with a
 * printed table code, a guest registering on it, and the register moving on the
 * organiser's screen. Same drawn layer as the setup clip, from
 * scripts/lib/record-ui.mts.
 *
 * The guest's half is shown at full width rather than on a phone frame: the
 * join page is built mobile-first and centres itself at 480 px, so it reads as
 * a phone screen on the cinematic backdrop without any faking.
 *
 * Output: recordings/cut-events-checkin.mp4
 */
import { chromium, type BrowserContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import {
  caption,
  encodeForWhatsApp,
  ensureOverlay,
  goto,
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
const RAW_DIR = `${OUT_DIR}/raw-checkin`;
const FINAL = `${OUT_DIR}/cut-events-checkin.mp4`;

const EVENT_TITLE = 'CUT Alumni Homecoming';
const GUEST = {
  first: 'Lindiwe',
  last: 'Dube',
  email: 'lindiwe.dube@example.com',
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

// ---------------------------------------------------------------------------
// Put the event back to the state this clip starts from, so it is repeatable:
// published, self-registration off, nobody checked in, and this guest unknown.
// ---------------------------------------------------------------------------

const { data: departments } = await db.from('departments').select('id').limit(1);
const departmentId = departments?.[0]?.id;
if (!departmentId) {
  console.error('No department on the project. Seed it first.');
  process.exit(1);
}

let { data: event } = await db.from('events').select('id').eq('title', EVENT_TITLE).maybeSingle();

if (!event) {
  const starts = new Date();
  starts.setDate(starts.getDate() + 21);
  starts.setHours(18, 0, 0, 0);
  const { data: made, error } = await db
    .from('events')
    .insert({
      department_id: departmentId,
      title: EVENT_TITLE,
      slug: `cut-alumni-homecoming-${Date.now().toString(36)}`,
      starts_at: starts.toISOString(),
      venue_name: 'CUT Bloemfontein Campus',
      capacity: 120,
      allow_plus_ones: true,
      auction_enabled: true,
      status: 'published',
    })
    .select('id')
    .single();
  if (error) {
    console.error(`Could not create the event: ${error.message}`);
    process.exit(1);
  }
  event = made;
  console.log('  created the event this clip needs');
}

const eventId = event!.id;

await db.from('attendees').delete().eq('event_id', eventId);
const { data: priorContact } = await db
  .from('contacts')
  .select('id')
  .eq('email', GUEST.email)
  .maybeSingle();
if (priorContact) {
  await db.from('consents').delete().eq('contact_id', priorContact.id);
  await db.from('contacts').delete().eq('id', priorContact.id);
}
await db
  .from('events')
  .update({ status: 'published', join_token: null, join_nonce: null })
  .eq('id', eventId);
console.log('  event reset: published, code off, nobody checked in');

// ---------------------------------------------------------------------------

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

// The very first thing painted, so the first frame is never a blank white one.
await showCard(
  page,
  [
    'Checking guests in',
    'CUT Events · Institutional Advancement',
    'One printed code on every table.',
  ],
  4200,
  true,
  'Checking guests in. One printed code on every table.',
  true,
);

const eventUrl = `${SITE}/events/${eventId}`;

// --- 1. Turn the code on --------------------------------------------------
await goto(page, eventUrl);
await setStep(page, 1, 'The table code');
await caption(page, 'Open the event, and look for the self-registration code.', 3200);
await smoothScroll(page, 760);
await pointAndClick(page, page.getByRole('link', { name: /Self-registration QR/i }).first(), 1800);
await ensureOverlay(page);

await caption(page, 'It is off until you switch it on.', 2800);
await pointAndClick(page, page.getByRole('button', { name: /Turn on self-registration/i }), 2800);
await caption(page, 'That is the code for this event, and nobody else’s.', 3400);

const joinUrl = await page.locator('input[aria-label="Self-registration link"]').inputValue();

// --- 2. The printed sheet -------------------------------------------------
await setStep(page, 2, 'Print it');
await caption(page, 'Click "Print sheet" for the page that goes on the tables.', 3200);
const printLink = page.getByRole('link', { name: /Print sheet/i });
// It normally opens a tab of its own; keep it here so the clip stays in one take.
await printLink.evaluate((el) => el.removeAttribute('target'));
await pointAndClick(page, printLink, 1800);
await ensureOverlay(page);
await caption(page, 'A4, with the code at 120 millimetres — readable across a table.', 4000);
await smoothScroll(page, 420);
await caption(page, 'The address is printed underneath, for a camera that will not focus.', 3800);

// --- 3. The guest ---------------------------------------------------------
await setStep(page, 3, 'A guest scans it');
await goto(page, joinUrl);
await caption(page, 'This is what opens on the guest’s phone. No app, no account.', 4000);
await pointAndType(page, page.locator('#firstName'), GUEST.first);
await pointAndType(page, page.locator('#lastName'), GUEST.last);
await pointAndType(page, page.locator('#email'), GUEST.email, 38);
await caption(page, 'The consent wording is stored with the version they agreed to.', 3600);
await pointAndClick(page, page.locator('input[name="consent"]'), 700);
await caption(page, 'Then one button.', 2000);
await pointAndClick(page, page.getByRole('button', { name: /Register and get my pass/i }), 3600);

await caption(page, 'Checked in, and Bidder 001 — the first guest through the door.', 4200);
await caption(
  page,
  'Scanning a code that only exists inside the venue is the proof of arrival.',
  4200,
);

// --- 4. Their pass --------------------------------------------------------
await setStep(page, 4, 'Their pass');
await pointAndClick(page, page.getByRole('link', { name: /Open your pass/i }), 2600);
await ensureOverlay(page);
await caption(page, 'Their pass. The code at the door, and their bidder number.', 4000);

// --- 5. The register ------------------------------------------------------
await setStep(page, 5, 'The register moves');
await goto(page, `${eventUrl}/attendance`);
await caption(page, 'And on the organiser’s screen, they are already at the top.', 4000);
await smoothScroll(page, 520);
await caption(page, 'Marked as a walk-in, time-stamped, with no usher needed.', 4000);

await showCard(
  page,
  [
    'No queue, no clipboard.',
    'The guest checks themselves in, and the room fills itself.',
    'cut-events.vercel.app',
  ],
  3600,
  false,
  'No queue, and no clipboard. The guest checks themselves in.',
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

writeFileSync(`${OUT_DIR}/narration-checkin.json`, JSON.stringify(trimmedBeats(), null, 2));

const mb = (statSync(FINAL).size / 1024 / 1024).toFixed(1);
console.log(`\n  ${FINAL}  (${mb} MB)`);
console.log(`  Event used: ${eventUrl}\n`);
