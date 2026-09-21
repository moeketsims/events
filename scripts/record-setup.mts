/**
 * Record the "set it up" clip — docs/08-WALKTHROUGH-RECORDING.md, Act 1.
 *
 *   pnpm exec tsx scripts/record-setup.mts
 *
 * A teaching video, not a showreel. It drives the deployed site with a real
 * Chromium and draws the things a screen recording cannot show by itself: a
 * cursor that travels to each control, a gold ring around that control before
 * it is used, and a pulse at the moment of the click. Captions are burned into
 * the page, because a clip shared on WhatsApp is watched with the sound off.
 *
 * Headless Chromium never paints an operating-system pointer into its
 * recording, so the cursor here is drawn in the page and moved to the real
 * bounding box of the real element a beat before the real click happens.
 *
 * Sign-in runs in a throwaway context whose cookies are copied into the
 * recorded one, so the one-time link never appears on screen.
 *
 * Output: recordings/cut-events-setup.mp4
 */
import { chromium, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import ffmpegPath from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, existsSync, statSync } from 'node:fs';

const SITE = process.env.SITE ?? 'https://cut-events.vercel.app';
const STAFF = 'organiser@demo.cut-events.test';
const OUT_DIR = 'recordings';
const RAW_DIR = `${OUT_DIR}/raw`;
const FINAL = `${OUT_DIR}/cut-events-setup.mp4`;

const EVENT = {
  title: 'CUT Alumni Homecoming',
  venue: 'CUT Bloemfontein Campus',
  capacity: '120',
};

/** How long the drawn cursor takes to travel. Slow enough to follow. */
const TRAVEL_MS = 680;

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// The drawn layer: cursor, ring, pulse, caption, step chip, cards
// ---------------------------------------------------------------------------

let cursor = { x: 640, y: 400 };
let step = 0;
let stepLabel = '';

const OVERLAY = String.raw`
(function () {
  if (document.getElementById('__ui')) return;
  const root = document.createElement('div');
  root.id = '__ui';
  root.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;pointer-events:none;' +
    'font-family:"Segoe UI",system-ui,sans-serif';
  root.innerHTML =
    '<div id="__ring" style="position:absolute;border:3px solid #FBB927;border-radius:12px;' +
      'box-shadow:0 0 0 6px rgba(251,185,39,.22),0 12px 40px rgba(0,0,0,.30);opacity:0;' +
      'transition:opacity .22s ease"></div>' +
    '<div id="__pulse" style="position:absolute;width:26px;height:26px;margin:-13px 0 0 -13px;' +
      'border-radius:50%;background:rgba(251,185,39,.6);opacity:0"></div>' +
    '<div id="__cursor" style="position:absolute;width:30px;height:30px;margin:-3px 0 0 -3px;' +
      'filter:drop-shadow(0 3px 6px rgba(0,0,0,.55))">' +
      '<svg viewBox="0 0 24 24" width="30" height="30">' +
      '<path d="M5 2.5 L5 19.5 L9.4 15.4 L12.3 21.6 L15.1 20.3 L12.3 14.3 L18.4 14.1 Z" ' +
      'fill="#ffffff" stroke="#001738" stroke-width="1.4" stroke-linejoin="round"/></svg></div>' +
    '<div id="__step" style="position:absolute;top:22px;right:22px;background:#001738;color:#FBB927;' +
      'border:2px solid rgba(251,185,39,.5);border-radius:999px;padding:8px 18px;font-size:18px;' +
      'font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:0;transition:opacity .3s"></div>' +
    '<div id="__cap" style="position:absolute;left:0;right:0;bottom:0;' +
      'background:linear-gradient(90deg,#001738 0%,#002a5c 100%);border-top:4px solid #FBB927;' +
      'color:#fff;font-size:30px;font-weight:600;line-height:1.3;padding:20px 34px;' +
      'box-shadow:0 -18px 44px rgba(0,0,0,.42);opacity:0;transition:opacity .28s ease"></div>';
  document.body.appendChild(root);
  const style = document.createElement('style');
  style.textContent =
    '@keyframes __pulse{0%{transform:scale(.4);opacity:.9}100%{transform:scale(3.8);opacity:0}}';
  document.head.appendChild(style);
})();
`;

/** Rebuild the drawn layer after a navigation and restore its state. */
async function ensureOverlay(page: Page): Promise<void> {
  await page.evaluate(OVERLAY);
  await page.evaluate(
    ({ x, y, n, label }) => {
      const c = document.getElementById('__cursor')!;
      c.style.transition = 'none';
      c.style.left = `${x}px`;
      c.style.top = `${y}px`;
      if (n > 0) {
        const s = document.getElementById('__step')!;
        s.textContent = `Step ${n} · ${label}`;
        s.style.opacity = '1';
      }
    },
    { ...cursor, n: step, label: stepLabel },
  );
}

async function caption(page: Page, text: string, holdMs = 2600): Promise<void> {
  await page.evaluate((t) => {
    const bar = document.getElementById('__cap')!;
    bar.style.opacity = '0';
    window.setTimeout(() => {
      bar.textContent = t;
      bar.style.opacity = '1';
    }, 150);
  }, text);
  await page.waitForTimeout(holdMs);
}

async function setStep(page: Page, n: number, label: string): Promise<void> {
  step = n;
  stepLabel = label;
  await page.evaluate(
    ({ n, label }) => {
      const s = document.getElementById('__step')!;
      s.style.opacity = '0';
      window.setTimeout(() => {
        s.textContent = `Step ${n} · ${label}`;
        s.style.opacity = '1';
      }, 180);
    },
    { n, label },
  );
  await page.waitForTimeout(420);
}

/** Move the drawn cursor to a point and wait for it to arrive. */
async function moveTo(page: Page, x: number, y: number): Promise<void> {
  cursor = { x, y };
  await page.evaluate(
    ({ x, y, ms }) => {
      const c = document.getElementById('__cursor')!;
      c.style.transition = `left ${ms}ms cubic-bezier(.33,0,.2,1), top ${ms}ms cubic-bezier(.33,0,.2,1)`;
      c.style.left = `${x}px`;
      c.style.top = `${y}px`;
    },
    { x, y, ms: TRAVEL_MS },
  );
  await page.waitForTimeout(TRAVEL_MS + 90);
}

/** Put the ring around an element, or hide it when passed null. */
async function ring(page: Page, target: Locator | null): Promise<void> {
  if (!target) {
    await page.evaluate(() => {
      document.getElementById('__ring')!.style.opacity = '0';
    });
    await page.waitForTimeout(180);
    return;
  }
  const box = await safeBox(page, target);
  if (!box) return;
  await page.evaluate(
    (b) => {
      const r = document.getElementById('__ring')!;
      const pad = 7;
      // Jump to the target rather than travelling to it: a ring sliding across
      // the page points at everything it passes over on the way.
      r.style.transition = 'none';
      r.style.left = `${b.x - pad}px`;
      r.style.top = `${b.y - pad}px`;
      r.style.width = `${b.width + pad * 2}px`;
      r.style.height = `${b.height + pad * 2}px`;
      void r.offsetWidth;
      r.style.transition = 'opacity .22s ease';
      r.style.opacity = '1';
    },
    { x: box.x, y: box.y, width: box.width, height: box.height },
  );
  await page.waitForTimeout(420);
}

/**
 * The box of an element, having first brought it somewhere the viewer can
 * actually watch it being used: clear of the caption bar along the bottom and
 * of the step chip at the top.
 */
async function safeBox(
  page: Page,
  target: Locator,
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  const vp = page.viewportSize() ?? { width: 1280, height: 720 };
  let box = await target.boundingBox();
  const hidden = !box || box.y < 96 || box.y + box.height > vp.height - 150;
  if (hidden) {
    await target
      .evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }))
      .catch(() => {});
    await page.waitForTimeout(820);
    box = await target.boundingBox();
  } else {
    await page.waitForTimeout(200);
  }
  return box;
}

async function pulse(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(
    ({ x, y }) => {
      const p = document.getElementById('__pulse')!;
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      p.style.opacity = '1';
      p.style.animation = 'none';
      void p.offsetWidth;
      p.style.animation = '__pulse .62s ease-out';
      window.setTimeout(() => {
        p.style.opacity = '0';
      }, 600);
    },
    { x, y },
  );
  await page.waitForTimeout(360);
}

/** Point at a control, ring it, pulse, then actually use it. */
async function pointAndClick(page: Page, target: Locator, afterMs = 700): Promise<void> {
  await ring(page, target);
  const box = await safeBox(page, target);
  if (!box) throw new Error('target has no bounding box');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await moveTo(page, x, y);
  await pulse(page, x, y);
  await target.click();
  await page.waitForTimeout(afterMs);
  await ring(page, null);
}

/** Point at a field and type into it at a readable speed. */
async function pointAndType(page: Page, target: Locator, text: string, delay = 55): Promise<void> {
  await ring(page, target);
  const box = await safeBox(page, target);
  if (box) {
    const x = box.x + Math.min(box.width / 2, 170);
    const y = box.y + box.height / 2;
    await moveTo(page, x, y);
    await pulse(page, x, y);
  }
  await target.click();
  await target.pressSequentially(text, { delay });
  await page.waitForTimeout(440);
  await ring(page, null);
}

async function showCard(
  page: Page,
  lines: string[],
  holdMs = 3400,
  fadeOut = false,
): Promise<void> {
  await page.evaluate(
    ({ ls, fade, hold }) => {
      const card = document.createElement('div');
      card.style.cssText =
        'position:fixed;inset:0;z-index:2147483647;background:linear-gradient(160deg,#001738 0%,#000d24 100%);' +
        'color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;' +
        'font-family:"Segoe UI",system-ui,sans-serif;text-align:center;opacity:0;transition:opacity .45s ease';
      card.innerHTML =
        '<div style="width:64px;height:4px;background:#FBB927;border-radius:2px;margin-bottom:8px"></div>' +
        ls
          .map((l, i) =>
            i === 0
              ? `<div style="font-size:56px;font-weight:700;line-height:1.1">${l}</div>`
              : `<div style="font-size:26px;line-height:1.5;color:rgba(255,255,255,.78);max-width:780px">${l}</div>`,
          )
          .join('');
      document.body.appendChild(card);
      requestAnimationFrame(() => {
        card.style.opacity = '1';
      });
      if (fade) {
        window.setTimeout(() => {
          card.style.opacity = '0';
          window.setTimeout(() => card.remove(), 500);
        }, hold - 500);
      }
    },
    { ls: lines, fade: fadeOut, hold: holdMs },
  );
  await page.waitForTimeout(holdMs);
}

async function goto(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'networkidle' });
  await ensureOverlay(page);
  await page.waitForTimeout(520);
}

async function smoothScroll(page: Page, to: number, ms = 1000): Promise<void> {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), to);
  await page.waitForTimeout(ms);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

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

// --- Title ----------------------------------------------------------------
await goto(page, `${SITE}/login`);
await showCard(
  page,
  [
    'Setting up an event',
    'CUT Events · Institutional Advancement',
    'Watch the gold ring. That is where to click.',
  ],
  4400,
  true,
);

// --- 1. Sign in -----------------------------------------------------------
await setStep(page, 1, 'Sign in');
await caption(page, 'Open cut-events.vercel.app and sign in with your CUT address.', 3400);
const emailField = page.locator('input[type="email"]').first();
if ((await emailField.count()) > 0) {
  await pointAndType(page, emailField, 'organiser@demo.cut-events.test', 50);
}
await caption(page, 'A six-digit code arrives by email. There is no password to remember.', 3800);

await ctx.addCookies(cookies);

// --- 2. The dashboard -----------------------------------------------------
await setStep(page, 2, 'Your dashboard');
await goto(page, `${SITE}/dashboard`);
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

await showCard(page, [
  'That is the setup.',
  'Next: print the table code, and guests check themselves in.',
  'cut-events.vercel.app',
]);

await ctx.close();
const raw = await page.video()?.path();
await browser.close();

if (!raw || !existsSync(raw)) {
  console.error('No video was produced.');
  process.exit(1);
}

// --- Encode for WhatsApp --------------------------------------------------
const ffmpeg = ffmpegPath as unknown as string;
if (!existsSync(ffmpeg)) {
  console.log('  fetching the ffmpeg binary…');
  execFileSync(
    process.execPath,
    ['node_modules/.pnpm/ffmpeg-static@5.3.0/node_modules/ffmpeg-static/install.js'],
    { stdio: 'inherit' },
  );
}

console.log('  encoding for WhatsApp…');
execFileSync(
  ffmpeg,
  [
    '-y',
    '-i',
    raw,
    '-f',
    'lavfi',
    '-i',
    'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-shortest',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '25',
    '-pix_fmt',
    'yuv420p',
    '-vf',
    'fps=30,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
    '-profile:v',
    'main',
    '-level',
    '4.0',
    '-c:a',
    'aac',
    '-b:a',
    '64k',
    '-movflags',
    '+faststart',
    FINAL,
  ],
  { stdio: 'ignore' },
);

const mb = (statSync(FINAL).size / 1024 / 1024).toFixed(1);
console.log(`\n  ${FINAL}  (${mb} MB)`);
console.log(`  Event created during the take: ${eventUrl}\n`);
