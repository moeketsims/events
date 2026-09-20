# 06 — Implementation plan: Weeks 3 and 4

For the implementing agent picking up after Week 2. Everything here is derived from `docs/01-BUILD-SPEC.md`, `docs/02-DESIGN-SYSTEM.md`, `docs/03-TASKS.md` and the code as it stands on `main` at commit `947328b`. Where this plan and the spec disagree, the spec wins on technical matters and `PLAN.md` wins on scope; note the disagreement in the commit body. Read `CLAUDE.md` first.

---

## 0. Where things stand

**Done and verified in the browser against the local Docker Supabase stack:** T1.1–T1.7 and T2.1–T2.7, plus a polish pass. `main` is in sync with GitHub; CI is green on every push; the Migrate workflow fails on every run because the three repository secrets have not been added. Nothing has yet been exercised on the hosted dev project, Resend, Meta or Yoco, and Vercel is not linked. Those are on Moeketsi.

**What Week 3 inherits that is already built and should not be rebuilt:**

| Layer | What exists | Where |
|---|---|---|
| Database | All 16 tables with RLS forced. `place_bid`, `set_lot_status`, `close_due_lots`, `void_bid`, `set_display_mode`, `log_audit`, `notify_broadcast`, `next_min_bid`, `bid_step`, views `lot_state` and `auction_totals` (`security_invoker`). Every `SECURITY DEFINER` function is revoked from `anon` and `authenticated` and granted to `service_role` alone. `pg_cron` runs `close_due_lots()` every 30 s locally. | `supabase/migrations/0001`–`0009`, tests in `supabase/tests/` |
| Realtime | Topic builders and payload types for every topic in BUILD-SPEC §4.6, `realtimeEnabled`, `POLL_INTERVAL_MS`. The `checkin` path is proven end to end. | `lib/realtime.ts`, pattern in `app/(staff)/events/[eventId]/attendance/LiveArrivals.tsx` |
| Messaging | `send()`, `sendMany()`, `channelReadiness()`; Resend, Brevo and Meta providers; templates for all seven kinds including `broadcast`, `outbid`, `winner`, `receipt`; Svix verification; the Resend webhook route. Every send writes a `message_deliveries` row first and fails gracefully with `not_configured`. | `lib/messaging/*`, `app/api/webhooks/resend/route.ts` |
| Auth | `requireStaff(roles)`, `getStaffProfile()`, `hasRole()`; the pass token library with `verifyTokenOfKind`, `extractToken`; `middleware.ts` mirrors the `/p/` token into the `cut_pass` cookie (shape check only, every consumer re-verifies). | `lib/auth/*`, `middleware.ts` |
| Money and time | `formatZAR`, `bidStep`, `nextMinBid`, `toCents`, `DEFAULT_INCREMENT_TABLE`; `formatCountdown`, `formatBidderNumber`, `formatEventDate`, `formatTime`. `bidStep` is pinned to the SQL by a shared test table. | `lib/money.ts`, `lib/dates.ts` |
| Consent | `AUCTION_TERMS` v1 wording, `CONSENT_PURPOSE.auction_terms`, `CONSENT_SOURCE`. | `lib/consent.ts` |
| Console UI | `StaffShell`, `PageHeader`, `SectionHeading`, `StatusPill` (own file, safe in client components), `Ledger` (+ `Arc`, `SeatRow`, `StatusLegend`), `Ticket`, `Desk` (with `soon`), `EventHero`. Table styling via `.card.table-card`. Dialog pattern in `app/(staff)/contacts/ImportDialog.tsx`. | `components/staff/*` |
| Attendee UI | `Atmosphere`, `Ballroom`, `Logo`, `.glass-panel`, `.input-dark`, `.text-gold-metallic`, `.hairline-gold`, `.reveal`, `CountUp`, `Marquee`, `LiveStrip`. The pass page at `app/p/[token]/page.tsx` is the reference for an attendee surface. | `components/brand/*`, `app/globals.css` |
| Feature gates | `lib/features.ts` with `broadcasts`, `auction`, `bidding`, `console`, `results` all `false`. Desk rows for them render as "Coming"; hero buttons hidden; the pass tells a checked-in guest bidding opens from the pass. **Flip each flag in the commit that lands its route.** | `lib/features.ts` |
| Seed | One live event, 40 contacts, 35 attendees (12 checked in, bidder numbers 1–12), one auction with six lots (lot 6 has no bids), 14 bids placed through `place_bid`, display key printed. Honours `DEMO_EMAIL_BASE` and `DEMO_PHONES`. | `supabase/seed/seed.ts`, `supabase/seed/data.ts` |

**Referenced but missing:** `scripts/bid-storm.ts` (T3.4) and `scripts/smoke-providers.ts` (T1.8) are in `package.json` but do not exist. Write both.

**Conventions established in code that the spec does not spell out:**
- JSON routes that a client `fetch`es (`/api/checkin`, `/api/walkin`, `/api/attendees`, `/api/events/[id]/counts`) use `getStaffProfile()` and return 401/403 JSON rather than `requireStaff()`, because `requireStaff` redirects. Keep that for `/api/bid` and the new auction routes. Validate route params with zod too (`z.uuid()`), which the existing `counts` and `attendance.csv` routes do not yet do; fix those in passing.
- Server Actions take `(prev, formData)` and return a state object `{ error?, notice?/report? }` for `useActionState`. Every action starts with `requireStaff([...])` then `schema.safeParse`.
- Attendee-facing server components use `createAdminClient()` and select only the columns the spec lists. They call `notFound()` on a bad token and check `attendee.pass_token === token` so a reissued pass revokes the old link.
- The `outbid` template already links to `${passUrl}/auction`; the `winner` template takes `payUrl`.
- Never run `next build` while `pnpm dev` is up. Use `pnpm build:check` (writes to `.next-prod`).

---

## 1. Order of work and how to report

Work T3.1 → T3.2 → T3.3 → T3.4 → T3.5, then T4.1 → T4.2 → T4.3 → T4.4 → T4.5. T3.4 can start once T3.3's `/api/bid` exists. T4.1 and T4.2 are independent of each other and both depend on T3.2 and T3.3.

One commit per task or sub-task, message prefixed with the id, `pnpm lint && pnpm typecheck && pnpm test` before every push, tick the task in `docs/03-TASKS.md` in the same commit with a "Verified" note in the style of the Week 2 entries (what was clicked, what the database held afterwards, what could not be checked locally and why). Stop and report to Moeketsi after T3.5 and after T4.5.

Prerequisites still outstanding, which the agent should ask for in one message at the start and then work around: `sb_secret_…` key for the dev project; Resend API key or Brevo choice; Meta test-number `PHONE_NUMBER_ID`, temporary access token, app secret and the five demo phone numbers; Yoco sandbox secret key; GitHub Actions secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`; Vercel link. Everything below builds without them; the "Done when" checks that need them are listed per task.

---

## 2. Week 3 — Broadcasts and Bidding

### T3.1 Broadcast composer and feed

**Goal.** An organiser's message reaches the pass pages of the chosen audience within a second and, where opted in, as a WhatsApp message. A guest who has not arrived does not receive a "checked in" broadcast.

**Data flow.** `sendBroadcast` (Server Action) → insert `broadcasts` row (`audience`, `channels`, `author_id`, `sent_at`) → resolve recipients → `sendMany()` with kind `broadcast`: one `in_app` job per attendee (always), one `whatsapp` job per attendee whose contact has `phone_e164` and `whatsapp_opt_in` (when chosen) → `admin.rpc('notify_broadcast', { p_broadcast_id })` → `revalidatePath`. The `in_app` delivery row **is** the delivery: `/p/[token]/feed` reads its own `in_app` rows, so audience membership is decided once, at send time (BUILD-SPEC §7.3).

**Audience resolution** (attendees of the event, joined to contacts):
- `checked_in`: `checked_in_at is not null`
- `all_accepted`: every attendee (they exist only for accepted invitations, walk-ins and plus-ones)
- `not_arrived`: `checked_in_at is null`
Plus-ones share their host's contact, so WhatsApp goes to the contact once per broadcast: de-duplicate WhatsApp jobs by `contact_id`, but write an `in_app` row for every attendee.

**Files.**
- `app/(staff)/events/[eventId]/broadcasts/page.tsx` (server; `requireStaff(['organiser','auction_operator'])`): loads event, audience counts for the three segments with WhatsApp reach for each, the broadcast log (`broadcasts` newest first with per-channel `sent`/`failed` counts from `message_deliveries` grouped by `broadcast_id, channel, status`), `channelReadiness()`.
- `app/(staff)/events/[eventId]/broadcasts/Composer.tsx` (client): textarea with a live character count that turns `gold-600` past 280 and never blocks; audience radio group with counts, like `invitations/Composer.tsx`; channel checkboxes with in-app always on and disabled, WhatsApp showing "n of them have a number and have opted in" and the not-configured warning; a confirm step "Send to 13 guests" before the action fires; the report from the action rendered like the invitations report.
- `app/(staff)/events/[eventId]/broadcasts/BroadcastLog.tsx` (client): one row per broadcast, body, time, audience label, per-channel chips (`13 in-app · 4 WhatsApp · 1 failed`), expandable per-recipient list fetched from `app/api/events/[eventId]/broadcasts/[broadcastId]/route.ts` (staff JSON: deliveries joined to attendees `display_name` and channel, status, error). Reuse `StatusPill` for delivery status; add `queued/sent/delivered/failed` to its map.
- `app/(staff)/events/[eventId]/broadcasts/actions.ts`: `sendBroadcast` with zod `{ eventId: z.uuid(), body: z.string().trim().min(1).max(2000), audience: z.enum([...]), channels: z.array(z.enum(['whatsapp'])) }`. Refuse when the event is `draft`. `maxDuration` is not settable on an action; 35 recipients × 2 channels at concurrency 5 is well under 60 s. If the recipient count exceeds 200, return an error telling the organiser to narrow the audience (POC limit, BUILD-SPEC §8).
- `app/p/[token]/feed/route.ts` (GET): verify token, match `pass_token`, return the last 50 broadcasts for this attendee: `message_deliveries` where `attendee_id = id and channel = 'in_app'` joined to `broadcasts(id, body, sent_at)`, newest first. Fields only `id, body, sentAt`. `Cache-Control: no-store`.
- `app/p/[token]/Feed.tsx` (client): renders the placeholder section that already exists on the pass page. Initial items come from the server component (same query, so first paint has content). Subscribes to `event:{eventId}` `broadcast` when `realtimeEnabled`, else polls `/p/[token]/feed` every `POLL_INTERVAL_MS`. On a payload, refetch the feed. New items get the 3 px gold left border (`border-l-[3px] border-gold-500`) until the item has been on screen for 3 s or the tab regains focus; track seen ids in `localStorage` under `cut_feed_seen:{attendeeId}`, wrapped in try/catch. Optional browser notification permission prompt after the first message; do not prompt on load.
- `app/api/webhooks/whatsapp/route.ts`: GET handshake (`hub.mode=subscribe`, `hub.verify_token === WHATSAPP_VERIFY_TOKEN` → return `hub.challenge` as text). POST: verify `X-Hub-Signature-256` as `sha256=` + HMAC-SHA256(`WHATSAPP_APP_SECRET`, raw body) with `timingSafeEqual`; parse `entry[].changes[].value.statuses[]` and update `message_deliveries` by `provider_message_id` (`sent`/`delivered`/`read` → `delivered`, `failed` → `failed` with `errors[0].title`); log `messages[]` (inbound) to `audit_log` action `whatsapp.inbound` with the wa_id and timestamp only. Always 200. Unit-test the signature check in `tests/unit/messaging.test.ts` alongside the Svix one. Note in `README.md` that the webhook URL must be public (Vercel or a `cloudflared` tunnel).
- Flip `FEATURES.broadcasts = true`. The hero Broadcast button and the desk rows come back on their own.

**Design.** Console page: `PageHeader` "Broadcasts", eyebrow "The room"; the composer is a `card`; the log uses the `Desk`-style hairline rows rather than a table, each row a message as it was sent. Pass feed per DESIGN-SYSTEM §5.2: newest first, time in `white/60` (never below 60 % on navy, T2.5 finding), gold left border while unread.

**Done when (local).** Sending to "checked in" writes one `in_app` row per checked-in attendee (13 in the seed) and zero for the 22 not arrived; a pass page for bidder 001 shows the message without reload within a second; the pass of an attendee with `checked_in_at null` does not; WhatsApp rows are `failed / not_configured` until keys arrive and the report says so; the log shows counts per channel. **Needs keys:** WhatsApp arrival on a test phone; webhook statuses moving to `delivered`.

### T3.2 Auction and lot editor

**Goal.** The seeded lots are editable; a new lot with two images appears in the attendee grid with its first image.

**Files.**
- `app/(staff)/events/[eventId]/auction/page.tsx` (`requireStaff(['organiser','auction_operator'])`): if `auction_enabled` is false or no `auctions` row exists, show an "Enable the silent auction" desk with one button that calls `enableAuction` (inserts `auctions` with defaults, sets `events.auction_enabled = true`). Otherwise: settings card, the lot catalogue, and the display card.
- `AuctionSettingsForm.tsx` (client) → `upsertAuction`: `title`, `closes_at` (datetime-local in SAST, use the same round-trip as `EventForms.tsx`), `soft_close_seconds` (30–600), increment table editor: rows of `{upTo, step}` with the last row `upTo = null`; validate ascending `upTo`, positive steps, last row open-ended; preview "From R0 to R1 000 bids rise by R100" lines. Mode fixed to `silent` (label only).
- `DisplayCard.tsx` (client): the projection URL `${APP_URL}/display/${auctionId}?k=${display_key}` with a copy button (`navigator.clipboard`, fallback selects the text), and "Regenerate key" → `regenerateDisplayKey` (writes `encode(gen_random_bytes(16),'hex')` via `admin.rpc`? No: do it in TypeScript with `crypto.randomBytes(16).toString('hex')` and a plain update through the user's client; RLS `auctions_dept_write` allows operators). Regenerating logs `auction.display_key_rotated` to `audit_log` via `log_audit`. Warn that the open projection will need the new link.
- `LotEditor.tsx` (client, dialog like `EditEventDialog`) → `upsertLot`: `lot_number` (auto next), `title`, `description`, `donor_name`, `starting_bid`, `reserve` (≥ starting bid or empty), `buy_now_price` (empty in POC; keep the column), `status` (`upcoming`/`open`/`withdrawn` only here; `closed`/`unsold` are outcomes), `closes_at` (defaults to the auction's), images.
- Images: client-side resize to ≤ 1600 px on the longest side to JPEG 0.85 via canvas (the banner upload in `EventForms.tsx` already does this; extract the helper to `lib/images.ts`), then a Server Action `uploadLotImage` that writes `lot-images/{auctionId}/{lotId}/{timestamp}.jpg` through the admin client (storage has no insert policies by design) and appends the public URL to `lots.images`. Thumbnails in the editor with remove and "make first" controls; `deleteLotImage` removes the object and the array entry.
- Lot list: `Ticket`-like rows? No: the lot catalogue is its own vocabulary. Use a `card` list where each lot is a row with a 4:3 thumbnail, number and title, current high bid from `lot_state`, status pill, closes-at, and a drag handle. Reorder with `@dnd-kit/core` + `@dnd-kit/sortable` (add the dependency) → `reorderLots(orderedIds)` writes `sort_order`. Keyboard reorder must work (dnd-kit provides it).
- `deleteLot`: allowed only when the lot has no bids; otherwise the action returns "Withdraw it instead".
- `actions.ts`: `enableAuction`, `upsertAuction`, `regenerateDisplayKey`, `upsertLot`, `deleteLot`, `reorderLots`, `uploadLotImage`, `deleteLotImage`; all `requireStaff(['organiser','auction_operator'])`, all zod. Lot writes go through the user's client so RLS applies; image bytes go through the admin client.
- Flip `FEATURES.auction = true`.

**Also.** `pnpm db:types:local` after any migration; there are none expected here. If `lots.images` needs the "first image" semantic, it is already positional.

**Done when.** Edit lot 2's title and see it on the attendee grid (T3.3) and projection (T4.1); create lot 7 with two images and see the first as its card image; regenerate the display key and confirm the old URL 403s on `/display` once T4.1 exists (until then, confirm the column changed).

### T3.3 Bidding pages

**Goal.** Two phones bidding on one lot see each other's bids under a second; the loser sees "Outbid"; a bid below the minimum is rejected with the minimum shown; a bid after close is rejected.

**Files.**
- `app/p/[token]/auction/layout.tsx`: verifies the token once, loads attendee + event + auction, renders the attendee frame (logo plate, event title) and the bottom nav Lots · My bids · Pass (DESIGN-SYSTEM §5.2), 56 px tall, gold active. Not checked in → render children read-only with the banner "Bidding opens once you have checked in at the door" and no bid buttons. `Atmosphere intensity={0.6}`.
- `app/p/[token]/auction/page.tsx`: lot grid from `lot_state` joined to `lots(images, description, donor_name, status, closes_at, starting_bid)` ordered by `sort_order, lot_number`; each card: 4:3 first image (`next/image`, the `remotePatterns` entry already allows storage URLs), lot number, title, current bid 24 px tabular or "Opening bid R500", "Next min R2 750", countdown, state badge, and Leading/Outbid badge computed from `high_bidder_number === attendee.bidder_number`. Wrapped in `AuctionLive.tsx` (client) which owns the lot map in state.
- `AuctionLive.tsx`: subscribes to `auction:{auctionId}` for `bid_placed`, `lot_status`, `bid_voided`, `display_mode` (ignore) and to `attendee:{attendeeId}` for `outbid`; applies payloads in place (`amount`, `bidder_number`, `closes_at`, `next_min`, `status`); on `bid_voided` refetches `/p/[token]/auction/state` because the payload has no bid count. Poll fallback: `GET /p/[token]/auction/state` every 2 s. Reconnect pill when the channel drops. Countdowns render from `closes_at` with a shared 250 ms ticker; under 2 min turn gold and say "closing soon"; on soft-close extension show "Extended" for 3 s.
- `app/p/[token]/auction/state/route.ts` (GET): anonymised `lot_state` rows for this auction plus `auction_totals`, `Cache-Control: no-store`. Fields only what the grid renders. Also used by the projection's poll fallback in T4.1 (a display-key variant lives under `/api/display/[auctionId]/state` there).
- `app/p/[token]/auction/[lotId]/page.tsx`: image carousel (all images, swipe), title, donor, description, current bid, bid count, countdown, the last five bids as "Bidder 017 · R2 500 · 21:14" (numbers only), then `BidPanel.tsx`.
- `BidPanel.tsx` (client): the 56 px `cut-900` button "Bid R2 750" (next_min from state); "Enter a different amount" reveals a numeric input with step enforcement client-side (`nextMinBid`/`bidStep` from `lib/money.ts` with the auction's increment table) and re-validation on the server; on first bid a T&Cs dialog with `AUCTION_TERMS` v1 and "I agree and place my bid" → the same `POST /api/bid` with `acceptTerms: true`. Result copy per `result`: `ok` → card pulses gold once, "You are leading at R2 750"; `too_low` → "The minimum is R2 750 now — someone got there first"; `lot_closed` → "Bidding on this lot has closed"; `not_checked_in` → the door banner; `not_an_attendee` → "This pass is for a different event". Disable the button while in flight; 10 s client cooldown message if the route returns 429.
- `app/api/bid/route.ts` (POST): token from body `token` or the `cut_pass` cookie; `verifyTokenOfKind(token,'p')`, match `attendees.pass_token`; zod `{ lotId: z.uuid(), amount: z.number().positive().multipleOf(0.01), acceptTerms: z.boolean().optional(), token: z.string().optional() }`; rate limit 10 requests per 10 s per attendee id in a module-level `Map` (acceptable for POC; note it resets per instance); `consents` is keyed by `contact_id`, not attendee: resolve `attendees.contact_id` (a plus-one shares the host's contact and so inherits the host's acceptance; a walk-in has their own contact). If no `consents` row exists for that contact with `purpose = 'auction_terms'` and `revoked_at is null`, and `acceptTerms` is not true → return `{ result: 'terms_required' }` with 200 (add this value to the contract and document it in BUILD-SPEC §7.3); if `acceptTerms` → insert `{ contact_id, purpose: CONSENT_PURPOSE.auctionTerms, channel: 'in_app', wording_version: AUCTION_TERMS_VERSION, source: CONSENT_SOURCE.auctionBid }`, then `admin.rpc('place_bid', { p_lot_id, p_attendee_id, p_amount })`; map the row to `{ result, highBid, nextMin, closesAt }`. `runtime = 'nodejs'`. Never trust `amount` as a string; coerce with `z.coerce.number()` only if the client sends strings.
- `app/p/[token]/bids/page.tsx`: my bids grouped by lot with leading/outbid state (from `lot_state.high_bidder_number`), voided bids shown struck through with "Withdrawn by the auction desk", won lots (`settlements` for this attendee) with a "Pay now" button that is a placeholder until T4.3 (render disabled with "Payment opens after the auction" if `checkout_url` is null).
- Outbid message: `place_bid` already sends the `outbid` realtime event. For the WhatsApp/email `outbid` message, do **not** send from the bid route synchronously (adds latency to every bid); leave to Stage B or, if time allows in T4.4, a debounced send. The in-app "Outbid" badge is the POC behaviour.
- Update `app/p/[token]/page.tsx`: the "Open the auction" link is already gated by `FEATURES.bidding`; flip `FEATURES.bidding = true`.

**Done when.** Two browser tabs on two seeded passes (bidder 001 and 002) bidding on lot 6: each sees the other's bid within a second without reload; the loser's card shows Outbid; a bid of R100 on a lot at R1 500 returns `too_low` with the minimum shown; set lot 6 `closes_at` to now via SQL and a bid returns `lot_closed`; the first bid from a fresh pass shows the T&Cs and writes a `consents` row `auction_terms v1`; a pass with `checked_in_at null` renders read-only; `/api/bid` with a tampered token returns 404-equivalent `invalid` and no bid. Confirm no surname reaches any bidding page or payload (`grep last_name app/p`).

### T3.4 Bid storm test

**Files.** `scripts/bid-storm.ts` (tsx, uses the admin client from env like `seed.ts`): pick the seeded auction's lot with the fewest bids, 20 checked-in attendees (check in more via `check_in_attendee` if fewer than 20), fire 100 bids concurrently (`Promise.all`) at amounts randomly `next_min` to `next_min + 3 steps` re-read every 10 bids, then assert: accepted bids strictly increasing by `placed_at`, every accepted amount ≥ previous + `bidStep`, no two accepted bids equal, `lot_state.high_bid` equals the max, `bid_count` equals accepted count. Print accepted/rejected counts, per-result histogram, wall time, and p50/p95 per call. Exit 1 on any assertion failure. Also run it through `/api/bid` against a running dev server when `BID_STORM_HTTP=1`, using the attendees' pass tokens, to exercise the rate limiter (expect 429s beyond 10 per 10 s per attendee — so spread 5 bids per attendee over the window). Record the run in the T3.4 tick.

### T3.5 Lot lifecycle and cron

- Confirm `close_due_lots()` runs on the dev project once the key arrives (`select * from cron.job`); if the schedule is refused, `0007` already documents the every-minute fallback. Locally it is proven.
- Attendee page: on `lot_status` with `closed`/`unsold`, the card flips to "Sold to Bidder 014 · R2 500" or "Not sold" and the bid button disappears; on a `bid_placed` whose `closes_at` moved later than the one held, show "Extended" for 3 s and restart the countdown.
- Add a `supabase/tests/03-lifecycle.sql` case only if behaviour changes; the existing `01-schema-behaviour.sql` already covers extension to 120 s and idempotent close.
- **Done when.** Lot with `closes_at` 90 s away, bid at 30 s remaining → `closes_at` becomes now + 120 s and the page says Extended; at close the lot is `closed` with a `settlements` row, or `unsold` under reserve, and every open bidding page and the projection reflect it without reload.

Stop after T3.5 and report.

---

## 3. Week 4 — Projection, Console, Results, Polish, Rehearsal

### T4.1 Projection view

- `app/display/[auctionId]/page.tsx` (server): read `k` from `searchParams`; compare with `auctions.display_key` (admin client, `timingSafeEqual`); on match set cookie `cut_display={auctionId}:{key}` for 24 h **in `middleware.ts`** (a Server Component cannot set cookies; the middleware already special-cases `/p/`, add `/display/` the same way: shape check only, page re-verifies). Without `k` and without a valid cookie → a minimal navy "This screen needs its display link" page, not a 404.
- `app/display/layout.tsx`: `<html class="theme-display">` equivalent — apply `.theme-display` on a wrapping `div` with `min-h-dvh`, `cursor: none; overflow: hidden`, no chrome, `Atmosphere intensity={1}` under the watermark, and a key handler that swallows `Escape`.
- `Board.tsx` (client): initial state from `lot_state` + `auction_totals` + `auctions(display_mode, spotlight_lot_id, title)`; subscribes to `auction:{id}` for all four events; poll fallback `GET /api/display/[auctionId]/state` (display-key or cookie authenticated, anonymised). Modes per DESIGN-SYSTEM §5.4: **grid** 3 × 2 lot cards (page through 6 at a time every 12 s if more than 6, showing "Lots 1–6 of 9"), current bid 72 px gold, bidder 28 px, countdown 28 px turning gold under 2 min, gold border flash 1.5 s on `bid_placed`; **spotlight** one lot, current bid 160 px, last five bids (fetched from `/api/display/[id]/lot/[lotId]/bids`, numbers only); **total** with `CountUp` mode `zar`, motto, vertical logo on plate. Footer `Marquee` ticker with the last 8 bids as chips. Header: logo plate, auction title 40 px, live dot and SAST clock. Reconnect pill bottom-left when the channel drops; the board never blanks. Fonts: check `Barlow Condensed` renders at 160 px without clipping in `line-height: 1`.
- `display_mode` events switch modes live; `set_display_mode` already broadcasts them.
- **Done when.** On a 1920×1080 window in fullscreen a bid from a phone appears within 1 s with the flash; switching modes from the console (T4.2) takes effect without reload; killing the network for 20 s shows the pill and recovers. At 1280×720 nothing overflows.

### T4.2 Operator console

- `app/(staff)/events/[eventId]/auction/console/page.tsx` (`requireStaff(['auction_operator','organiser'])`): full-width, no sidebar (like `/scan/[eventId]`), because it runs on a laptop beside the projector. Top strip: total raised (metallic gold), lots open/closed, display mode switcher (grid / spotlight [lot picker] / total) → `setDisplayMode` action → `admin.rpc('set_display_mode')`. Lot table (`ConsoleLive.tsx`, client, same subscription as the board): number, title, status pill, current bid, bidder number, countdown, and per-lot controls Open · Close now · Extend 2 min · Withdraw → `setLotStatus(lotId, status, closesAt?)` → `admin.rpc('set_lot_status')`; "Close now" sets `closes_at = now()` and status stays `open` so `close_due_lots` settles it within 30 s (or call `close_due_lots` directly from the action for immediacy: do that, and say so in the commit).
- **Reveal bidder**: button on the leading bid → `revealBidder(attendeeId)` action → `log_audit(actor, 'bidder.identity_viewed', 'attendees', id, {lot_id})` then returns `display_name`, contact `phone_e164`, table if `rsvps.answers` has one; rendered in a popover that closes after 20 s. Never rendered server-side by default; the reveal is a deliberate click.
- **Void latest bid**: per lot, "Void" opens a dialog with a reason (required, ≥ 5 chars) → `voidBid(bidId, reason)` → `admin.rpc('void_bid')`. Show the new leader from the returned row.
- **Proxy bid**: search attendee by name or bidder number via `/api/attendees` (exists) filtered to checked-in, amount input pre-filled with `next_min` → `proxyBid(lotId, attendeeId, amount)` → `admin.rpc('place_bid', { p_is_proxy: true, p_staff_id })`. Same `result` copy as the phone.
- All actions `requireStaff(['auction_operator','organiser'])` and check the event belongs to the profile's department before calling a service-role function (the admin client bypasses RLS; the check in `/api/checkin` is the pattern).
- Flip `FEATURES.console = true`.
- **Done when.** Every control changes the projection and an open bidding page live; `audit_log` has a row per reveal and per void; `door@` gets the 403 page.

### T4.3 Results, settlement, payments

- `app/(staff)/events/[eventId]/results/page.tsx` (`requireStaff(['organiser','finance','auction_operator'])`): per lot: number, title, status, winner **name** (staff surface; names allowed), bidder number, amount, reserve met, settlement status pill, paid at. Totals: raised, settled, outstanding. CSV export route `app/api/events/[eventId]/results.csv/route.ts` using `lib/csv.ts` (BOM, CRLF, SAST times; the phone-number rule is already there). Audit-log the export like attendance does.
- "Send winner notices" button → `sendWinnerNotices(eventId)`: for every `settlements` row with `status = 'pending'` and no `winner` delivery yet: create the Yoco checkout (below), store `checkout_url`, then `sendMany` kind `winner` by email and WhatsApp (opt-in) with `payUrl = checkout_url`, `amount = formatZAR`, `lotTitle`. Idempotent: skip settlements that already have a `winner` delivery with status `sent`.
- `lib/payments/yoco.ts`: `createCheckout(settlementId)` → `POST https://payments.yoco.com/api/checkouts` with `amount: toCents(amount)`, `currency: 'ZAR'`, `successUrl: ${APP_URL}/p/${token}/bids?paid=1`, `cancelUrl`, `failureUrl`, `metadata: { settlementId }`; store `provider_ref = id`, `checkout_url = redirectUrl`, `payment_provider = 'yoco'`. `isConfigured()` on `YOCO_SECRET_KEY`; not configured → the notice still goes out with the pass bids page as `payUrl` and the results page shows "Payment link pending".
- `app/api/webhooks/yoco/route.ts`: verify per Yoco's docs (webhook-id, webhook-timestamp, webhook-signature headers, HMAC-SHA256 of `${id}.${timestamp}.${body}` with the base64 secret after the `whsec_` prefix; it is the Svix scheme, so reuse `lib/messaging/svix.ts` `verifySvixSignature`); on `payment.succeeded` set `settlements.status = 'paid'`, `paid_at`, `provider_ref`, then send kind `receipt`. Always 200 after verification.
- `/p/[token]/bids`: "Pay now" becomes a real link to `checkout_url`; after `?paid=1` show "Thank you" and the settlement status (re-read; the webhook may lag a few seconds, so poll `/p/[token]/bids/state` every 2 s for 30 s).
- Flip `FEATURES.results = true`.
- **Done when (needs Yoco key and a public URL).** Close a lot, press Send winner notices, open the link, pay with a Yoco test card, results page shows Paid. **Local:** the sequence runs with `not_configured` recorded and the results page showing pending.

### T4.4 Polish and hardening

- `loading.tsx` with `Skeleton` on every staff route group and on `/p/[token]/auction`; `error.tsx` boundaries that render the 403 for `ForbiddenError` (already exists for `(staff)`; check `/scan` and `/display`); `sonner` toasts for every action result on the console.
- Rate limit on `/api/bid` (from T3.3) plus `/api/checkin` and `/api/walkin` at 60 per minute per staff id.
- Zod audit: add `z.uuid()` param checks to `attendance.csv` and `counts` routes; check `submitRsvp` writes for unchecked `error` returns (there are about six) and surface a failure.
- Mobile pass at 360 px on pass, auction grid, lot detail and bids; projection at 1280×720.
- `prefers-reduced-motion`: the global rule exists; confirm the board flash, ticker and CountUp respect it.
- Sentry: `@sentry/nextjs` only if `SENTRY_DSN` is set; otherwise no-op. Keep it out of the pass page bundle.
- Lighthouse ≥ 90 accessibility on `/rsvp`, `/p`, `/p/auction`: run `pnpm build:check && pnpm start:check` and Lighthouse in Chrome DevTools; record scores.
- Write `scripts/smoke-providers.ts`: sends one test email, one WhatsApp `hello_world` template and creates one Yoco checkout, printing each result; exits non-zero on failure.

### T4.5 Demo rehearsal

Follow `docs/04-DEMO-SCRIPT.md` twice on the real projector and phones, `pnpm seed` between runs, fix what surprised you, fill in the pre-demo checklist. Needs Vercel (HTTPS for the camera) and the provider keys.

---

## 4. Cross-cutting decisions already taken

- **Feature flags** stay in `lib/features.ts` until T4.4, then delete the file and the `soon` branches once every flag is `true`, or keep it if Stage B wants dark launches. Decide at T4.4 and note it.
- **No new migrations expected** in Weeks 3–4. If one is needed (for example a `terms_accepted_at` shortcut), it is a new file `0010_…sql`, RLS considered, `supabase/tests` updated, `pnpm db:types:local` run and `lib/db/types.ts` committed.
- **Anonymity.** Public and attendee surfaces render bidder numbers only. `grep -n "last_name" app/p app/display` must return nothing at the end of Week 3 and Week 4. Realtime payloads are built in SQL and already carry no names; do not add fields to them.
- **One bid path.** The console's proxy bid, the phone's bid and the storm all call `place_bid` through the admin client. No action inserts into `bids`.
- **Time.** Render every time with `lib/dates.ts`; countdowns compute from `closes_at` and `Date.now()`; correct for client clock skew by comparing the server `now` returned from the state route once on load.
- **Seed additions** for the rehearsal: set two lots' `closes_at` relative to run time via `DEMO_LOT_CLOSE_MINUTES=6,9`; print the console URL alongside the display URL.

---

## 5. Verification the agent cannot do alone

Needs a device or a public URL, so say so in the tick and leave to Moeketsi: camera scanning over HTTPS; WhatsApp arrival; Resend delivery and webhook; Yoco checkout and webhook; the projector at 1920×1080; two physical phones bidding on LTE. Everything else is verifiable against the local stack, and the ticks must say what was verified and how.
