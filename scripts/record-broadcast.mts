/**
 * Record the "reaching the room" clip — docs/08.
 *
 *   pnpm exec tsx scripts/record-broadcast.mts
 *
 * One message from the Advancement desk to every guest already in the room,
 * landing on the pass in their pocket, and the delivery log that proves it.
 *
 * The message is really sent, to the seeded Gala's real audience, and the clip
 * then opens a guest's own pass to show it arrive. Email and WhatsApp are not
 * connected on this project, so the in-app channel is the one that carries it —
 * which the captions say rather than hide.
 *
 * Output: recordings/cut-events-broadcast.mp4
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
const RAW_DIR = `${OUT_DIR}/raw-broadcast`;
const FINAL = `${OUT_DIR}/cut-events-broadcast.mp4`;

const MESSAGE =
  'Welcome to the Gala. The silent auction is open and closes at 21:30. ' +
  'Tap Auction on your pass to bid.';

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

const { data: event } = await db
  .from('events')
  .select('id, title')
  .ilike('title', '%Gala%')
  .maybeSingle();

if (!event) {
  console.error('No Gala event. Run scripts/reseed-hosted.sh first.');
  process.exit(1);
}

/** A guest already in the room, whose pass will receive the message. */
const { data: inTheRoom } = await db
  .from('attendees')
  .select('id, display_name, pass_token')
  .eq('event_id', event.id)
  .not('checked_in_at', 'is', null)
  .not('pass_token', 'is', null)
  .not('display_name', 'ilike', 'Guest of%')
  .order('bidder_number', { ascending: true })
  .limit(1)
  .maybeSingle();

if (!inTheRoom) {
  console.error('Nobody is checked in. Run scripts/record-door.mts or reseed first.');
  process.exit(1);
}

// Start from a quiet feed, so the message that arrives is unmistakably this one.
const { data: priorBroadcasts } = await db.from('broadcasts').select('id').eq('event_id', event.id);
const priorIds = (priorBroadcasts ?? []).map((b) => b.id);
if (priorIds.length) {
  await db.from('message_deliveries').delete().in('broadcast_id', priorIds);
  await db.from('broadcasts').delete().in('id', priorIds);
  console.log(`  cleared ${priorIds.length} earlier broadcast(s)`);
}

console.log(`  the message will land on ${inTheRoom.display_name}'s pass`);

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
    'Reaching the room',
    'CUT Events · Institutional Advancement',
    'One message, on every pass in the building.',
  ],
  4200,
  true,
  'Reaching the room. One message, on every pass in the building.',
  true,
);

const eventUrl = `${SITE}/events/${event.id}`;

// --- 1. Write it ----------------------------------------------------------
await goto(page, `${eventUrl}/broadcasts`);
await setStep(page, 1, 'Write the message');
await caption(page, 'The Advancement desk, halfway through the evening.', 3400);

const body = page.locator('textarea[name="body"]').first();
if ((await body.count()) > 0) {
  await pointAndType(page, body, MESSAGE, 26);
  await caption(page, 'Short, because it is read on a phone under a table.', 3600);
}

// --- 2. Who gets it -------------------------------------------------------
await setStep(page, 2, 'Choose the room');
await smoothScroll(page, 360);
await caption(
  page,
  'Everyone who has arrived, everyone who accepted, or those still to come.',
  4600,
);
const checkedIn = page.locator('input[name="audience"][value="checked_in"]').first();
if ((await checkedIn.count()) > 0) {
  await pointAndClick(page, checkedIn, 900);
}
await caption(page, 'In-app always. Email and WhatsApp when their keys are in place.', 4200);
await caption(page, 'Neither is connected here, so this one goes to the passes.', 4000);

// --- 3. Send it -----------------------------------------------------------
await setStep(page, 3, 'Send it');
const sendButton = page.getByRole('button', { name: /Send to \d+ guest/i }).first();
if ((await sendButton.count()) > 0) {
  await pointAndClick(page, sendButton, 1600);
  await ensureOverlay(page);
  await caption(page, 'It asks once, because a message cannot be recalled.', 3800);
  const confirm = page.getByRole('button', { name: /^Send now$|^Send$/i }).first();
  const anyConfirm =
    (await confirm.count()) > 0 ? confirm : page.getByRole('button', { name: /Send/i }).last();
  await pointAndClick(page, anyConfirm, 4200);
  await ensureOverlay(page);
  await caption(page, 'Sent, and logged guest by guest.', 3400);
}

await smoothScroll(page, 900);
await caption(page, 'Every message this platform sends is logged here, and kept.', 4000);

// --- 4. On the guest's pass ----------------------------------------------
await setStep(page, 4, 'On their pass');
await goto(page, `${SITE}/p/${inTheRoom.pass_token}`);
await smoothScroll(page, 640);
await caption(
  page,
  `And on ${(inTheRoom.display_name ?? '').split(' ')[0]}’s pass, it is already there.`,
  4400,
);
await caption(
  page,
  'No app, no notification to allow. It is on the page they already have open.',
  4600,
);
await hideCaption(page);
await page.waitForTimeout(2000);

await showCard(
  page,
  [
    'The whole room, at once.',
    'Announcements, a change of plan, or the auction closing in ten minutes.',
    'cut-events.vercel.app',
  ],
  3600,
  false,
  'The whole room at once, whether it is a change of plan or the auction closing.',
);

await ctx.close();
const raw = await page.video()?.path();
await browser.close();

if (!raw || !existsSync(raw)) {
  console.error('No video was produced.');
  process.exit(1);
}

const { data: sent } = await db
  .from('broadcasts')
  .select('id, body, sent_at')
  .eq('event_id', event.id)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();
const { count } = await db
  .from('message_deliveries')
  .select('id', { count: 'exact', head: true })
  .eq('broadcast_id', sent?.id ?? '00000000-0000-0000-0000-000000000000');
console.log(
  sent?.sent_at
    ? `  broadcast sent to ${count ?? 0} deliveries`
    : '  WARNING: no broadcast was sent during the take',
);

console.log('  encoding for WhatsApp…');
encodeForWhatsApp(raw, FINAL);
writeFileSync(`${OUT_DIR}/narration-broadcast.json`, JSON.stringify(trimmedBeats(), null, 2));

const mb = (statSync(FINAL).size / 1024 / 1024).toFixed(1);
console.log(`\n  ${FINAL}  (${mb} MB)\n`);
