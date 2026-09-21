/**
 * The drawn layer shared by the walkthrough recorders.
 *
 * A screen recording shows what happened but not where to look, so every
 * recorder draws the same three things over the real page: a cursor that
 * travels to each control, a gold ring that lands on that control before it is
 * used, and a pulse at the moment of the click. Captions are burned in too,
 * because these clips are shared on WhatsApp and watched with the sound off.
 *
 * Headless Chromium never paints an operating-system pointer into its
 * recording, which is why the cursor is drawn in the page and moved to the real
 * bounding box of the real element a beat before the real click happens.
 */
import type { Locator, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import ffmpegPath from 'ffmpeg-static';

/** How long the drawn cursor takes to travel. Slow enough to follow. */
const TRAVEL_MS = 680;

export type Beat = { at: number; text: string };

/**
 * Seconds trimmed off the front of every clip. Playwright starts recording the
 * moment the page object exists, which is before anything has been painted, so
 * the opening frames are blank white — and a blank white first frame is exactly
 * what WhatsApp turns into the thumbnail. Recorders paint a card immediately
 * and this drops whatever preceded it.
 */
export const TRIM_START = 0.5;

/** Shift the caption timeline to match the trimmed video. */
export function trimmedBeats(): Beat[] {
  return state.beats.map((b) => ({
    ...b,
    at: Number(Math.max(0, b.at - TRIM_START).toFixed(2)),
  }));
}

const state = { cursor: { x: 640, y: 400 }, step: 0, label: '', t0: 0, beats: [] as Beat[] };

/** Start the clock at the first recorded frame, so narration can be timed to it. */
export function startClock(): void {
  state.t0 = Date.now();
}

export function beats(): Beat[] {
  return state.beats;
}

/** Note that a line is being said now. `offset` covers the caption's fade-in. */
function mark(text: string, offset = 0.15): void {
  if (state.t0 === 0) return;
  state.beats.push({ at: Number(((Date.now() - state.t0) / 1000 + offset).toFixed(2)), text });
}

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

/**
 * Rebuild the drawn layer after a navigation and restore its state.
 *
 * A click can start a navigation that tears the JavaScript context down while
 * this is still running, which is a race rather than a fault: wait for the new
 * document and draw again. Nothing here is worth failing a two-minute take for,
 * so a second failure is swallowed.
 */
export async function ensureOverlay(page: Page): Promise<void> {
  try {
    await paintOverlay(page);
  } catch {
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(250);
    await paintOverlay(page).catch(() => {});
  }
}

async function paintOverlay(page: Page): Promise<void> {
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
    { ...state.cursor, n: state.step, label: state.label },
  );
}

export async function caption(page: Page, text: string, holdMs = 2600): Promise<void> {
  mark(text);
  await ensureOverlay(page);
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

/** Clear the caption bar, for moments where the page itself is the point. */
export async function hideCaption(page: Page): Promise<void> {
  await ensureOverlay(page);
  await page
    .evaluate(() => {
      const bar = document.getElementById('__cap');
      if (bar) bar.style.opacity = '0';
    })
    .catch(() => {});
  await page.waitForTimeout(280);
}

export async function setStep(page: Page, n: number, label: string): Promise<void> {
  await ensureOverlay(page);
  state.step = n;
  state.label = label;
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
export async function moveTo(page: Page, x: number, y: number): Promise<void> {
  await ensureOverlay(page);
  state.cursor = { x, y };
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

/**
 * The box of an element, having first brought it somewhere the viewer can
 * watch it being used: clear of the caption bar along the bottom and of the
 * step chip at the top.
 */
export async function safeBox(
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

/** Put the ring around an element, or hide it when passed null. */
export async function ring(page: Page, target: Locator | null): Promise<void> {
  await ensureOverlay(page);
  if (!target) {
    await page
      .evaluate(() => {
        const r = document.getElementById('__ring');
        if (r) r.style.opacity = '0';
      })
      .catch(() => {});
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

export async function pulse(page: Page, x: number, y: number): Promise<void> {
  await ensureOverlay(page);
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
export async function pointAndClick(page: Page, target: Locator, afterMs = 700): Promise<void> {
  await ring(page, target);
  const box = await safeBox(page, target);
  if (!box) throw new Error('target has no bounding box');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await moveTo(page, x, y);
  await pulse(page, x, y);
  await target.click();
  await ring(page, null);
  await page.waitForTimeout(afterMs);
}

/** Point at a field and type into it at a readable speed. */
export async function pointAndType(
  page: Page,
  target: Locator,
  text: string,
  delay = 55,
): Promise<void> {
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
  await ring(page, null);
  await page.waitForTimeout(440);
}

export async function showCard(
  page: Page,
  lines: string[],
  holdMs = 3400,
  fadeOut = false,
  narration?: string,
  /** Skip the fade-in. Used for the opening card, which must be the first frame. */
  instant = false,
): Promise<void> {
  if (narration) mark(narration, 0.5);
  await page.evaluate(
    ({ ls, fade, hold, now }) => {
      const card = document.createElement('div');
      card.style.cssText =
        'position:fixed;inset:0;z-index:2147483647;background:linear-gradient(160deg,#001738 0%,#000d24 100%);' +
        'color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;' +
        'font-family:"Segoe UI",system-ui,sans-serif;text-align:center;transition:opacity .45s ease;' +
        (now ? 'opacity:1' : 'opacity:0');
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
      if (!now) {
        requestAnimationFrame(() => {
          card.style.opacity = '1';
        });
      }
      if (fade) {
        window.setTimeout(() => {
          card.style.opacity = '0';
          window.setTimeout(() => card.remove(), 500);
        }, hold - 500);
      }
    },
    { ls: lines, fade: fadeOut, hold: holdMs, now: instant },
  );
  await page.waitForTimeout(holdMs);
}

export async function goto(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'networkidle' });
  await ensureOverlay(page);
  await page.waitForTimeout(520);
}

export async function smoothScroll(page: Page, to: number, ms = 1000): Promise<void> {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), to);
  await page.waitForTimeout(ms);
}

/**
 * Encode for WhatsApp. Constrained Baseline at level 3.1 with a real AAC track
 * is the combination every phone will play, and moving the index to the front
 * lets it start before the download finishes.
 */
export function encodeForWhatsApp(raw: string, out: string, trimStart = TRIM_START): void {
  const ffmpeg = ffmpegPath as unknown as string;
  if (!existsSync(ffmpeg)) {
    execFileSync(
      process.execPath,
      ['node_modules/.pnpm/ffmpeg-static@5.3.0/node_modules/ffmpeg-static/install.js'],
      { stdio: 'inherit' },
    );
  }
  execFileSync(
    ffmpeg,
    [
      '-y',
      // Fast-seek past the blank frames before the first painted card.
      '-ss',
      String(trimStart),
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
      '-profile:v',
      'baseline',
      '-level',
      '3.1',
      '-vf',
      'fps=30,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-ar',
      '44100',
      '-ac',
      '2',
      '-movflags',
      '+faststart',
      out,
    ],
    { stdio: 'ignore' },
  );
}
