/**
 * Record the "inviting your guests" clip — docs/08.
 *
 *   pnpm exec tsx scripts/record-invitations.mts
 *
 * The half of the evening that happens weeks before it: the department's
 * contact list, building an event's guest list from it, composing one
 * invitation for everybody, and a guest opening their own link and replying.
 *
 * Runs on the same CUT Alumni Homecoming the setup and check-in clips use, so
 * the three read as one story. Invitations and replies are cleared first so the
 * counts start from nothing.
 *
 * Output: recordings/cut-events-invitations.mp4
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
const RAW_DIR = `${OUT_DIR}/raw-invitations`;
const FINAL = `${OUT_DIR}/cut-events-invitations.mp4`;
const EVENT_TITLE = 'CUT Alumni Homecoming';

const BODY =
  'Dear {{first_name}}, the Advancement office would be delighted to welcome you ' +
  'back for the {{event_title}} at {{venue}} on {{starts_at}}. Please let us know ' +
  'whether we may keep a seat for you.';

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

// --- Back to the state this clip starts from ------------------------------

const { data: event } = await db
  .from('events')
  .select('id, allow_plus_ones')
  .eq('title', EVENT_TITLE)
  .maybeSingle();

if (!event) {
  console.error(`No "${EVENT_TITLE}" event. Run scripts/record-setup.mts first.`);
  process.exit(1);
}
const eventId = event.id;

const { data: priorInvites } = await db.from('invitations').select('id').eq('event_id', eventId);
const priorIds = (priorInvites ?? []).map((i) => i.id);
if (priorIds.length) {
  await db.from('rsvps').delete().in('invitation_id', priorIds);
  await db.from('attendees').delete().in('invitation_id', priorIds);
  await db.from('invitations').delete().in('id', priorIds);
}

// Custom questions, so the reply shows what an organiser can actually ask.
const { data: questions } = await db.from('event_questions').select('id').eq('event_id', eventId);
if (!questions?.length) {
  await db.from('event_questions').insert([
    {
      event_id: eventId,
      label: 'Dietary requirements',
      type: 'select',
      options: ['None', 'Vegetarian', 'Halaal', 'Kosher', 'Other'],
      required: false,
      sort_order: 1,
    },
    {
      event_id: eventId,
      label: 'Do you need step-free access?',
      type: 'boolean',
      required: false,
      sort_order: 2,
    },
  ]);
}

await db.from('events').update({ status: 'published', allow_plus_ones: true }).eq('id', eventId);
console.log('  event reset: published, nobody invited, two questions on the form');

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
    'Inviting your guests',
    'CUT Events · Institutional Advancement',
    'From the contact list to a reply in the diary.',
  ],
  4200,
  true,
  'Inviting your guests, from the contact list to a reply in the diary.',
  true,
);

const eventUrl = `${SITE}/events/${eventId}`;

// --- 1. The contact list --------------------------------------------------
await goto(page, `${SITE}/contacts`);
await setStep(page, 1, 'Your contacts');
await caption(page, 'One contact list for the whole department.', 3200);
await caption(page, 'Donors, alumni and sponsors, kept once and reused by every event.', 4000);

const search = page.locator('input[placeholder="Name, email or organisation"]').first();
if ((await search.count()) > 0) {
  await caption(page, 'Search by name, email or organisation.', 2400);
  await pointAndType(page, search, 'Mokoena', 80);
  await search.press('Enter');
  await page.waitForLoadState('networkidle').catch(() => {});
  await ensureOverlay(page);
  // Caption the result, not the full list it was typed over.
  await caption(page, 'One name, and the list is down to the people who match.', 4000);
}

await goto(page, `${SITE}/contacts`);
await caption(page, 'Tags cut the list down: alumni, donors, a particular faculty.', 4000);

const importButton = page.getByRole('button', { name: /Import a CSV/i }).first();
if ((await importButton.count()) > 0) {
  await caption(page, 'A spreadsheet from anywhere comes straight in.', 3000);
  await pointAndClick(page, importButton, 2000);
  await caption(page, 'Paste the rows, and it matches on email so nobody is duplicated.', 4200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(900);
  await ensureOverlay(page);
}

// --- 2. The guest list ----------------------------------------------------
await goto(page, `${eventUrl}/guests`);
await setStep(page, 2, 'Build the guest list');
await caption(page, 'The event’s own list is chosen from those contacts.', 3600);

let added = 0;
const COUNT_TO_TICK = 4;
try {
  const openPicker = page.getByRole('button', { name: /^Add guests$/i }).first();
  if ((await openPicker.count()) > 0) {
    await caption(page, 'Open the picker: everyone not already invited is in it.', 3400);
    await pointAndClick(page, openPicker, 1600);
    await ensureOverlay(page);

    // The picker is a dialog, so it is portalled outside <main>. The first box
    // in it is "Select everyone shown", which is not what the caption says we
    // are doing, so only the per-person boxes are ticked.
    const boxes = page.locator('[role="dialog"] input[type="checkbox"]:not([aria-label])');
    const n = Math.min(await boxes.count(), COUNT_TO_TICK);
    if (n > 0) {
      await caption(page, 'Tick the people you want at this one.', 2800);
      for (let i = 0; i < n; i++) {
        await pointAndClick(page, boxes.nth(i), 340);
        added++;
      }
      const add = page
        .locator('[role="dialog"]')
        .getByRole('button', { name: /add .* to the event/i })
        .first();
      if ((await add.count()) > 0) {
        await pointAndClick(page, add, 3000);
        await ensureOverlay(page);
        await caption(page, 'Every one of them now has a private link of their own.', 4000);
      }
    }
  }
} catch {
  await page.waitForTimeout(800);
}

// --- 3. The invitation ----------------------------------------------------
await goto(page, `${eventUrl}/invitations`);
await setStep(page, 3, 'Write it once');
await caption(page, 'One invitation, written once, for everybody on the list.', 3600);

const body = page.locator('textarea[name="body"]').first();
if ((await body.count()) > 0) {
  await body.fill('');
  await pointAndType(page, body, BODY, 22);
  await caption(page, 'The fields in braces fill in each guest’s own details.', 3800);
}

await smoothScroll(page, 420);
await caption(page, 'The preview is a real guest, so you see exactly what they will.', 4200);
await smoothScroll(page, 860);
await caption(page, 'Choose who it goes to, and whether by email, WhatsApp or both.', 4200);
await caption(page, 'Neither provider is connected on this demo, so nothing is sent today.', 4200);

// --- 4. The guest replies -------------------------------------------------
const { data: invites } = await db
  .from('invitations')
  .select('token, contacts(first_name, last_name)')
  .eq('event_id', eventId)
  .eq('status', 'pending')
  .limit(1);

const invite = invites?.[0];
if (invite?.token) {
  const who = invite.contacts?.first_name ?? 'the guest';
  await setStep(page, 4, 'The guest replies');
  await goto(page, `${SITE}/rsvp/${invite.token}`);
  await caption(page, `This is the link in ${who}’s inbox. No account, no password.`, 4200);
  await smoothScroll(page, 260);

  try {
    const yes = page.locator('label').filter({ hasText: 'Yes, I will be there' }).first();
    await caption(page, 'They answer in one tap.', 2600);
    await pointAndClick(page, yes, 1200);

    const seats = page.locator('select#guestCount').first();
    if ((await seats.count()) > 0) {
      await caption(page, 'How many seats, if the event allows a plus-one.', 3200);
      await ring(page, seats);
      await seats.selectOption('2');
      await page.waitForTimeout(900);
      await ring(page, null);
      const guestName = page.locator('input[name="guestNames"]').first();
      if ((await guestName.count()) > 0) {
        await pointAndType(page, guestName, 'Sipho Dlamini', 45);
      }
    }

    await smoothScroll(page, 560);
    await caption(page, 'And the questions the organiser asked, answered here.', 3600);
    const dietary = page.locator('select').filter({ hasNotText: 'seats' }).last();
    if ((await dietary.count()) > 0) {
      await ring(page, dietary);
      await dietary.selectOption({ index: 2 }).catch(() => {});
      await page.waitForTimeout(800);
      await ring(page, null);
    }

    await smoothScroll(page, 820);
    const consent = page.locator('input[name="whatsappOptIn"]').first();
    if ((await consent.count()) > 0) {
      await caption(page, 'The consent wording is stored with the version they agreed to.', 4000);
      await pointAndClick(page, consent, 700);
    }

    const submit = page.getByRole('button', { name: /count me in/i }).first();
    await caption(page, 'Then they send it.', 2200);
    await pointAndClick(page, submit, 3800);
    await ensureOverlay(page);
    await caption(page, 'Their seats are held, and their pass is already issued.', 4200);
    await caption(page, 'No app to install. The link is the invitation and the ticket.', 4000);
  } catch {
    await page.waitForTimeout(1200);
  }
}

// --- 5. Back on the console -----------------------------------------------
await setStep(page, 5, 'The replies come in');
await goto(page, eventUrl);
await smoothScroll(page, 300);
await caption(page, 'And on the console, the answer is already counted.', 4000);
await hideCaption(page);
await page.waitForTimeout(1800);

await showCard(
  page,
  [
    'Invited, replied, seated.',
    'One list, one invitation, and a pass issued the moment they say yes.',
    'cut-events.vercel.app',
  ],
  3600,
  false,
  'Invited, replied and seated, with a pass issued the moment they say yes.',
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
writeFileSync(`${OUT_DIR}/narration-invitations.json`, JSON.stringify(trimmedBeats(), null, 2));

const mb = (statSync(FINAL).size / 1024 / 1024).toFixed(1);
console.log(`\n  ${FINAL}  (${mb} MB)`);
console.log(`  ${added} guests added during the take\n`);
