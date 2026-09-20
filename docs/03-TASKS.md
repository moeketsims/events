# 03 — Task Breakdown (Stage A: Proof of Concept)

Four weeks. Each task is sized for a single sitting, states what "done" means, and names its dependencies. Work top to bottom within a week; tasks marked ∥ can run in parallel with the one above.

Conventions for the implementer: one branch per task (`t1-3-migrations`), one PR, CI green, squash-merge to `main`. Commit messages in imperative mood. Never commit `.env.local`. Every schema change is a migration file. Every Server Action validates with zod. Every new route has at least a smoke test or a manual check noted in the PR.

Prerequisites the **user** must supply before Week 1 finishes (the agent should ask for them up front, in one message, then proceed with everything that does not depend on them):

- [ ] Supabase dev project reference and `sb_secret_…` key (publishable key is already in the global CLAUDE.md).
- [ ] A domain for sending email, verified in Resend; or confirmation to use Brevo.
- [ ] Meta for Developers app with WhatsApp test number, `PHONE_NUMBER_ID`, temporary access token, and the five demo phone numbers added as recipients.
- [ ] Yoco sandbox secret key.
- [ ] GitHub repository (https://github.com/moeketsims/events.git) and a Vercel account linked to it.

---

## Week 1 — Foundation

**Goal:** `main` deploys to Vercel, migrations apply to the dev project, a seeded event is visible after OTP login.

### T1.1 Scaffold the application
- `pnpm create next-app@latest` with TypeScript, App Router, Tailwind, ESLint, `src` off, import alias `@/*`.
- Add shadcn/ui (`pnpm dlx shadcn@latest init`), lucide, zod, `@supabase/supabase-js`, `@supabase/ssr`, `qrcode`, `html5-qrcode`, vitest, prettier.
- `next/font/google` Barlow Condensed and Source Sans 3 in `app/layout.tsx`, exposed as CSS variables `--font-display` and `--font-body`.
- Copy `public/brand/favicon-src/favicon.ico` → `app/favicon.ico`, `favicon-32x32.png` → `app/icon.png`, and `public/icons/apple-touch-icon.png` → `app/apple-icon.png`. Set `metadata.openGraph.images` to `/og-image.png`.
- `.gitignore`, `.env.example` with every variable from BUILD-SPEC §3, `README.md` with setup steps.
- **Done when:** `pnpm dev` renders a page with the font applied; `pnpm lint && pnpm typecheck && pnpm test` pass with one placeholder test.

### T1.2 Design tokens and brand components ∥
- `app/globals.css` `@theme` block from DESIGN-SYSTEM §2.2; shadcn variable mapping; `.theme-display` class.
- **Already done:** `scripts/fetch-brand-assets.{sh,ps1}` have been run; the official logo files, watermark, spacing guide and CUT favicon set are in `public/brand/` with `SOURCES.md`. `scripts/generate-derived-assets.py` has produced PWA icons, the OG image, a banner placeholder and six lot placeholders (inventory in DESIGN-SYSTEM §8). Do not re-fetch unless CUT updates its logo.
- `components/brand/Logo.tsx`, `BrandFrame.tsx` using those files.
- `public/manifest.webmanifest` referencing `public/icons/*` (name "CUT Events", short name "CUT Events", theme `#003261`, background `#FFFFFF`, `display: standalone`).
- **Done when:** a `/styleguide` dev-only page shows tokens, type scale, buttons, badges, and both logo variants on light and dark.

### T1.3 Supabase project link and migrations
- `supabase init`, `supabase link --project-ref …`.
- Write migrations `0001`–`0007` exactly as in BUILD-SPEC §4 (fix ordering: `citext` before `contacts`).
- `pnpm db:push` script → `supabase db push`; `pnpm db:types` → `supabase gen types typescript --linked > lib/db/types.ts`.
- **Done when:** `supabase db push` succeeds on a fresh dev project; `lot_state` view returns rows after inserting test data by hand; `select cron.schedule…` is present (or the every-minute fallback is documented in the migration comment).

### T1.4 Supabase clients and staff auth
- `lib/supabase/{client,server,admin}.ts` per BUILD-SPEC §1; `middleware.ts` refreshing sessions.
- `/login` with email OTP (request code, verify code), `requireStaff(roles)` helper, `/dashboard` placeholder that shows the signed-in profile and role.
- **Done when:** a seeded user receives a code, logs in, sees the dashboard; an unauthenticated visit to `/dashboard` redirects to `/login`; a `door_staff` user visiting `/events/new` gets 403.

### T1.5 Token signing library ∥
- `lib/auth/pass.ts` per BUILD-SPEC §6, constant-time compare.
- `lib/money.ts` with `formatZAR`, `bidStep`, `nextMinBid`.
- Unit tests for both, including the SQL-parity table of cases for `bidStep`.
- **Done when:** tests pass; tampered token returns `null`.

### T1.6 Seed script
- `supabase/seed/seed.ts` per BUILD-SPEC §11 using the admin client and Auth admin API. `pnpm seed`.
- Six lot images already exist at `supabase/seed/lots/lot-{1..6}.jpg` (branded placeholders, 1200×900, ~40 KB each); the seed uploads them to the `lot-images` bucket. Institutional Advancement will supply real photographs before the pilot.
- **Done when:** running twice leaves exactly one demo department, 40 contacts, 1 event, 40 invitations, 28+ attendees (12 checked in with bidder numbers 1–12), 1 auction, 6 lots, seeded bids; the script prints organiser magic link, two pass URLs, display URL.

### T1.7 CI/CD and hosting
- `ci.yml`: install, lint, typecheck, test, `supabase db push --dry-run` on PRs.
- `migrate.yml`: `supabase db push` on push to `main` using `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` secrets.
- `keepalive.yml`: weekly `curl` to `/api/cron/keepalive` with the bearer secret; implement the route.
- Vercel project linked to the repo, env vars set, production branch `main`.
- **Done when:** a PR shows green checks; merging deploys; `https://<app>.vercel.app/login` works; keepalive returns 200.

### T1.8 Provider applications (user, in parallel)
- Create Resend account and verify domain (or Brevo). Create Meta app, add test recipients. Create Yoco sandbox. Record all values in Vercel and `.env.local`.
- **Done when:** a test email, a test WhatsApp "hello_world" template message, and a Yoco sandbox checkout each succeed from a scratch script `scripts/smoke-providers.ts`.

---

## Week 2 — Invite → RSVP → Pass → Scan

**Goal:** an organiser imports contacts, creates an event, sends invitations, a guest RSVPs, receives a QR pass, and is scanned in at the door.

### T2.1 Contacts
- `/contacts` list with search, tag filter, pagination (50/page).
- CSV import dialog: paste or upload; columns `first_name,last_name,email,phone,organisation,tags,alumni_year`; preview; `importContacts` action with de-dupe by email then phone; phone normalised to E.164 (`0821234567` → `+27821234567`).
- Unit tests for parsing and normalisation.
- **Done when:** importing the same CSV twice reports 0 inserted on the second run; malformed rows are listed with line numbers.

### T2.2 Events CRUD
- `/events` list grouped by status; `/events/new` form; `/events/[id]` overview with funnel tiles (invited, accepted, declined, pending, checked in) and quick links; edit dialog; banner upload to `event-banners`.
- Status transitions: draft → published → live → closed. `live` is set manually or automatically when the first check-in happens.
- **Done when:** an organiser creates an event, uploads a banner, and sees it in the list; a door-staff user sees the event but no edit controls.

### T2.3 Guest list and invitations
- `/events/[id]/guests`: contact picker with the same filters as `/contacts`, "Add to event" creates `invitations` with signed `r.` tokens; table of invitees with status and channel history; remove invitee (only while `pending`).
- `/events/[id]/invitations`: template preview with merge fields (`{{first_name}}`, `{{event_title}}`, `{{rsvp_url}}`, `{{starts_at}}`, `{{venue}}`), channel checkboxes (email, WhatsApp), recipient filter (all pending / selected), send button with count confirmation.
- Messaging layer `lib/messaging/*` per BUILD-SPEC §8 with `invite` and `pass` templates; Resend and Meta implementations; `message_deliveries` written for each recipient.
- Resend webhook route updating statuses and `opened_at`.
- **Done when:** sending to 3 test contacts creates 3 delivery rows that move to `sent`, the email renders correctly in Gmail and Outlook web, and the WhatsApp text arrives on a test phone.

### T2.4 RSVP page
- `/rsvp/[token]`: verify token, load invitation + event; if `rsvp_deadline` passed show a closed message; form per BUILD-SPEC §7.3 including plus-one names when allowed and the consent checkbox (wording `v1`).
- Submit: upsert `rsvps`, set `invitations.status`, create `attendees` (one per guest) with signed `p.` tokens, insert `consents`, send `pass` message by email and WhatsApp (if opted in), render success with pass link and "Add to calendar" `.ics`.
- Declining shows a courteous message and no pass.
- **Done when:** accepting creates attendees and sends the pass; revisiting the link shows the current answer and allows changing it until the deadline; capacity reached puts new acceptances on `waitlisted`.

### T2.5 Pass page
- `/p/[token]`: layout verifies token and sets the `cut_pass` cookie; page per DESIGN-SYSTEM §5.2 with SVG QR (`qrcode`, error correction `M`), event details, calendar link, bidder badge when present, placeholder feed section, auction link state.
- `lib/qr.ts` also renders PNG to Storage `passes/{attendeeId}.png` at pass creation for WhatsApp.
- **Done when:** the page scores ≥ 90 on Lighthouse accessibility and loads under 1 MB; the QR decodes to the pass URL on a phone camera app.

### T2.6 Scanner PWA
- `public/manifest.webmanifest`, icons, `display: standalone`, theme colour `#003261`.
- `/scan` event picker; `/scan/[eventId]` with `html5-qrcode`, viewfinder styling, result cards, tabs Scan · Search · Walk-in · Count per DESIGN-SYSTEM §5.3.
- `POST /api/checkin` verifying staff session and token, calling `check_in_attendee`; `POST /api/walkin`.
- Duplicate-scan guard on the client: ignore the same token for 3 s.
- **Done when:** on an Android phone and an iPhone, scanning a pass from another phone's screen checks the guest in within 2 s; a second scan shows "Already checked in"; a pass from another event shows "Not valid for this event"; walk-in creates and checks in a guest; the count tab updates live.

### T2.7 Attendance dashboard
- `/events/[id]/attendance`: live count tile, arrivals-per-15-minutes bar, table of attendees with status, check-in time, scanner, bidder number; filter checked-in / not arrived; CSV export; subscribes to `event:{id}` `checkin`.
- Manual check-in button per row (organiser).
- **Done when:** a scan on the phone changes the count on the laptop without reload; export opens in Excel with correct columns.

---

## Week 3 — Broadcasts and Bidding

**Goal:** an organiser's message reaches checked-in phones instantly and via WhatsApp; attendees bid and the ledger is correct under load.

### T3.1 Broadcast composer and feed
- `/events/[id]/broadcasts`: compose (280 chars soft limit, no hard limit), audience selector (checked in / all accepted / not yet arrived), channel checkboxes (in-app always on; WhatsApp), preview of recipient count, send; log table with per-channel delivered/failed counts and an expandable per-recipient view.
- `sendBroadcast` action: insert `broadcasts`, write deliveries, send WhatsApp text via Meta, `realtime.send` on `event:{id}` `broadcast`.
- Pass page feed: subscribe, on `broadcast` event refetch `/p/[token]/feed` (route returns the last 50 broadcasts for the attendee's audience), unread gold border, browser notification permission prompt after the first message (optional).
- WhatsApp webhook route (verification handshake + statuses + inbound logging).
- **Done when:** sending to "checked in" lands on a checked-in phone's pass page under 1 s and as a WhatsApp message; a not-checked-in attendee does not receive it; delivery statuses update from the webhook.

### T3.2 Auction and lot editor
- `/events/[id]/auction`: enable auction (creates `auctions` row), settings (mode fixed `silent` in POC, closes at, soft close seconds, increment table editor with validation), display URL with copy button and "Regenerate key".
- Lot CRUD: number, title, description, donor, images (multi-upload, client resize), starting bid, reserve, buy-now, status; drag reorder.
- **Done when:** the seeded lots are editable; a new lot with two images appears in the attendee grid with the first image.

### T3.3 Bidding pages
- `/p/[token]/auction` grid and `/p/[token]/auction/[lotId]` detail per DESIGN-SYSTEM §5.2; T&Cs modal on first bid storing a consent row `auction_terms v1`; bid button with proposed amount; custom amount input.
- `POST /api/bid` calling `place_bid`; response handling for every `result` value with the right copy.
- Realtime: subscribe to `auction:{id}` for `bid_placed`, `lot_status`, `bid_voided` and to `attendee:{id}` for `outbid`; update cards in place; leading/outbid badges computed from `bidder_number` in payload vs the attendee's own.
- Not checked in: pages render read-only with the explanatory banner.
- `/p/[token]/bids`: my bids grouped by lot, leading/outbid, won lots (after close) with "Pay now" placeholder button (wired in T4.3).
- **Done when:** two phones bidding on one lot see each other's bids under 1 s; the losing phone sees "Outbid"; a bid below the minimum is rejected with the minimum shown; a bid after close is rejected.

### T3.4 Bid storm test ∥
- `scripts/bid-storm.ts` per BUILD-SPEC §12: 20 attendees × 5 bids each, fired concurrently at one lot with random amounts around the running minimum.
- **Done when:** the resulting ledger has strictly increasing accepted amounts with valid steps and no duplicates; the script prints accepted/rejected counts and the run time; result recorded in the PR.

### T3.5 Lot lifecycle and cron
- Verify `close_due_lots` on the dev project; adjust cron interval if sub-minute is unsupported.
- Soft-close behaviour visible on the attendee page: countdown extends and shows "Extended".
- **Done when:** a lot with `closes_at` 90 s away receives a bid at 30 s and extends to 120 s; at close it becomes `closed` with a settlement row, or `unsold` if under reserve.

---

## Week 4 — Projection, Console, Results, Polish, Rehearsal

**Goal:** the full 15-minute demo runs end to end on the real projector twice without intervention.

### T4.1 Projection view
- `/display/[auctionId]` with display-key auth and 24 h cookie; grid, spotlight, total modes per DESIGN-SYSTEM §5.4; ticker; reconnect pill; `theme-display`; watermark background.
- Mode switching from the console via `auctions.branding.display_mode` and a `lot_status`-topic broadcast event `display_mode`.
- **Done when:** on a 1920×1080 external display in fullscreen, a bid from a phone appears within 1 s with the gold flash; switching modes from the console takes effect without reload; unplugging Wi-Fi for 20 s shows the pill and recovers.

### T4.2 Operator console
- `/events/[id]/auction/console`: lot list with state, current bid, bidder number, countdown; per-lot Open / Close now / Extend 2 min / Withdraw; "Reveal bidder" showing name, table, phone (audit-logged); void latest bid with reason; proxy bid form (search attendee by name or bidder number, amount); display mode switcher; total raised.
- Server Actions `setLotStatus`, `voidBid`, `revealBidder`, `proxyBid` with role checks.
- **Done when:** every control changes the projection and attendee pages live; `audit_log` has a row per reveal and void; a door-staff user cannot open the console.

### T4.3 Results, settlement, payments
- `/events/[id]/results`: per lot winner name, bidder number, amount, reserve met, settlement status; totals; CSV export.
- Winner notification (`winner` template) sent by email and WhatsApp at lot close from `close_due_lots` via a lightweight poller in a Server Action or by the console "Send winner notices" button (POC choice: button).
- Yoco checkout per BUILD-SPEC §9 wired to "Pay now" on `/p/[token]/bids`; webhook marks paid; results page reflects it.
- **Done when:** closing a lot, pressing "Send winner notices", paying with a Yoco test card, and seeing "Paid" on results all work in sequence.

### T4.4 Polish and hardening
- Loading and empty states on every page; error boundaries; toast feedback for every action.
- Rate limit on `/api/bid`; zod validation audit of every action and route.
- Mobile pass on the pass and auction pages at 360 px; projection at 1280×720 as a fallback size.
- `prefers-reduced-motion` respected.
- Sentry wired if DSN present.
- **Done when:** a click-through of every route as each role finds no console errors and no unstyled state; Lighthouse accessibility ≥ 90 on `/rsvp`, `/p`, `/p/auction`.

### T4.5 Demo rehearsal
- Follow `04-DEMO-SCRIPT.md` twice on the actual projector and phones. Reset with `pnpm seed` between runs.
- Fix everything that surprised you; write the pre-demo checklist results into the script.
- **Done when:** two consecutive clean runs, timed under 15 minutes, with the checklist complete.

---

## Definition of done for Stage A

- All tasks above merged to `main`; CI green; deployed on Vercel.
- `pnpm seed` produces the demo state from empty in under 2 minutes.
- Bid storm passes.
- The demo runs clean twice.
- `PLAN.md` Section 10 open questions are presented to Institutional Advancement together with the demo.
- No real personal data in the system.
