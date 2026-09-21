/**
 * Record the "set it up" clip — docs/08, Act 1.
 *
 *   pnpm exec tsx scripts/record-setup.mts
 *
 * A staff member signs in, creates an event from nothing, publishes it and
 * builds the guest list. The drawn cursor, ring and click pulse come from
 * scripts/lib/record-ui.mts, shared with the other recorders.
 *
 * Sign-in runs in a throwaway context whose cookies are copied into the
 * recorded one, so the one-time link never appears on screen.
 *
 * Output: recordings/cut-events-setup.mp4
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
const RAW_DIR = `${OUT_DIR}/raw-setup`;
const FINAL = `${OUT_DIR}/cut-events-setup.mp4`;

const EVENT = {
  title: 'CUT Alumni Homecoming',
  venue: 'CUT Bloemfontein Campus',
  capacity: '120',
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

/** Three weeks out, 18:00, in the shape a datetime-local input wants. */
function startsAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + 21);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T18:00`;
}

const env = readEnv('.deploy/secrets.env');
if (!env.SUPABASE_PROJECT_REF || !env.SUPABASE_SECRET_KEY) {
  console.error('Missing SUPABASE_PROJECT_REF or SUPABASE_SECRET_KEY in .deploy/secrets.env');
  process.exit(1);
}

const db = createClient(`https://${env.SUPABASE_PROJECT_REF}.supabase.co`, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Clear events left by an earlier take so re-running does not pile them up.
// Matched on the exact recording title, so it can never touch the seeded Gala.
const { data: stale } = await db.from('events').select('id').eq('title', EVENT.title);
const staleIds = (stale ?? []).map((e) => e.id);
if (staleIds.length > 0) {
  const { data: auctions } = await db.from('auctions').select('id').in('event_id', staleIds);
  const auctionIds = (auctions ?? []).map((a) => a.id);
  if (auctionIds.length) {
    const { data: lots } = await db.from('lots').select('id').in('auction_id', auctionIds);
    const lotIds = (lots ?? []).map((l) => l.id);
    if (lotIds.length) {
      await db.from('bids').delete().in('lot_id', lotIds);
      await db.from('settlements').delete().in('lot_id', lotIds);
      await db.from('lots').delete().in('id', lotIds);
    }
    await db.from('auctions').delete().in('id', auctionIds);
  }
  const { data: invites } = await db.from('invitations').select('id').in('event_id', staleIds);
  const inviteIds = (invites ?? []).map((i) => i.id);
  if (inviteIds.length) {
    await db.from('rsvps').delete().in('invitation_id', inviteIds);
    await db.from('invitations').delete().in('id', inviteIds);
  }
  await db.from('message_deliveries').delete().in('event_id', staleIds);
  await db.from('attendees').delete().in('event_id', staleIds);
  await db.from('event_questions').delete().in('event_id', staleIds);
  await db.from('events').delete().in('id', staleIds);
  console.log(`  cleared ${staleIds.length} event(s) from an earlier take`);
}

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
const page = await ctx.newPage();
startClock();

// Painted before anything is navigated to, so the first frame is never blank
// white — which is the frame WhatsApp turns into the thumbnail.
await showCard(
  page,
  [
    'Setting up an event',
    'CUT Events · Institutional Advancement',
    'Watch the gold ring. That is where to click.',
  ],
  4200,
  true,
  'Setting up an event on CUT Events. Watch the gold ring — that is where to click.',
  true,
);

// --- 1. Sign in -----------------------------------------------------------
await goto(page, `${SITE}/login`);
await setStep(page, 1, 'Sign in');
await caption(page, 'Open cut-events.vercel.app and sign in with your CUT address.', 3400);
const emailField = page.locator('input[type="email"]').first();
if ((await emailField.count()) > 0) {
  await pointAndType(page, emailField, STAFF, 50);
}
await caption(page, 'A six-digit code arrives by email. There is no password to remember.', 3800);

await ctx.addCookies(cookies);

// --- 2. The dashboard -----------------------------------------------------
await goto(page, `${SITE}/dashboard`);
await setStep(page, 2, 'Your dashboard');
await caption(page, 'This is the evening at a glance.', 3000);
await smoothScroll(page, 460);
await caption(page, 'Who was invited, who replied, and who is already in the room.', 3600);
await smoothScroll(page, 0);

// --- 3. Create the event --------------------------------------------------
await setStep(page, 3, 'Create the event');
const createLink = page.getByRole('link', { name: /create an event/i }).first();
if ((await createLink.count()) > 0) {
  await caption(page, 'Click "Create an event".', 2200);
  await pointAndClick(page, createLink, 1600);
  await page.waitForURL(/\/events\/new/, { timeout: 30_000 }).catch(() => {});
  await ensureOverlay(page);
} else {
  await goto(page, `${SITE}/events/new`);
}
await page.waitForTimeout(700);

await caption(page, 'Give the event a name.', 2200);
await pointAndType(page, page.locator('#title'), EVENT.title);

await caption(page, 'Set the date and time. South African time, on a 24-hour clock.', 3000);
await ring(page, page.locator('#startsAt'));
await page.locator('#startsAt').fill(startsAt());
await page.waitForTimeout(800);
await ring(page, null);

await caption(page, 'Then the venue, and how many seats there are.', 2800);
await pointAndType(page, page.locator('#venueName'), EVENT.venue, 40);
await ring(page, page.locator('#capacity'));
await page.locator('#capacity').fill(EVENT.capacity);
await page.waitForTimeout(700);
await ring(page, null);

await smoothScroll(page, 380);
await caption(page, 'Tick the auction, and check-in will hand every guest a bidder number.', 4000);
await pointAndClick(page, page.locator('input[name="allowPlusOnes"]'), 500);
await pointAndClick(page, page.locator('input[name="auctionEnabled"]'), 800);

await caption(page, 'Click "Create event".', 2200);
await pointAndClick(page, page.getByRole('button', { name: 'Create event' }), 600);
await page.waitForURL(/\/events\/[0-9a-f-]{36}$/, { timeout: 45_000 });
await ensureOverlay(page);
await page.waitForTimeout(1500);
const eventUrl = page.url();

// --- 4. Publish it --------------------------------------------------------
await setStep(page, 4, 'Publish');
await caption(page, 'It exists now, as a draft. A draft is invisible to everyone.', 3600);
await smoothScroll(page, 560);
try {
  const publish = page.getByRole('button', { name: 'Publish', exact: true });
  await caption(page, 'Click "Publish" to open it to guests.', 2600);
  await pointAndClick(page, publish, 2800);
  await caption(page, 'Published. Guests can reply, and the table codes now work.', 3600);
} catch {
  await caption(page, 'Publish it, and guests can reply.', 3000);
}

// --- 5. The guest list ----------------------------------------------------
await setStep(page, 5, 'Add guests');
await goto(page, `${eventUrl}/guests`);
await caption(page, 'Contacts belong to the department, not to one event.', 3400);
try {
  const boxes = page.locator('main input[type="checkbox"]');
  const n = Math.min(await boxes.count(), 3);
  if (n > 0) {
    await caption(page, 'Tick the people you want, then add them to the event.', 3200);
    for (let i = 0; i < n; i++) {
      await pointAndClick(page, boxes.nth(i), 340);
    }
    const add = page.getByRole('button', { name: /add .* to the event/i }).first();
    if ((await add.count()) > 0) {
      await pointAndClick(page, add, 2600);
      await caption(page, 'Each one now has a private invitation link of their own.', 3600);
    }
  }
} catch {
  await page.waitForTimeout(900);
}

// --- 6. What comes next ---------------------------------------------------
await setStep(page, 6, 'Run the evening');
await goto(page, eventUrl);
await smoothScroll(page, 820);
await caption(page, 'The door, the table codes, the auction — all from this one page.', 4200);

await showCard(
  page,
  [
    'That is the setup.',
    'Next: print the table code, and guests check themselves in.',
    'cut-events.vercel.app',
  ],
  3600,
  false,
  'And that is the setup. Next, print the table code, and guests check themselves in.',
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

writeFileSync(`${OUT_DIR}/narration-setup.json`, JSON.stringify(trimmedBeats(), null, 2));

const mb = (statSync(FINAL).size / 1024 / 1024).toFixed(1);
console.log(`\n  ${FINAL}  (${mb} MB)`);
console.log(`  Event created during the take: ${eventUrl}\n`);
