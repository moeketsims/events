# 03 — Task Breakdown (Stage A: Proof of Concept)

Four weeks. Each task is sized for a single sitting, states what "done" means, and names its dependencies. Work top to bottom within a week; tasks marked ∥ can run in parallel with the one above.

Conventions for the implementer: work directly on `main` in task-sized commits (one or a few commits per task, each leaving the app buildable), and push after every task so CI runs and Vercel deploys. Open a PR only when a task is risky enough that you want CI to gate it before merge. Commit messages in imperative mood, prefixed with the task id (`T2.4 RSVP page with consent and pass issuance`). Never commit `.env.local`. Every schema change is a migration file. Every Server Action validates with zod. Every task ends with its "Done when" checks actually performed and ticked in this file.

Prerequisites the **user** must supply before Week 1 finishes (the agent should ask for them up front, in one message, then proceed with everything that does not depend on them):

- [ ] Supabase dev project reference and `sb_secret_…` key (publishable key is already in the global CLAUDE.md).
- [ ] A domain for sending email, verified in Resend; or confirmation to use Brevo.
- [ ] Meta for Developers app with WhatsApp test number, `PHONE_NUMBER_ID`, temporary access token, and the five demo phone numbers added as recipients.
- [ ] Yoco sandbox secret key.
- [ ] GitHub repository (https://github.com/moeketsims/events.git) and a Vercel account linked to it.

---

## Week 1 — Foundation

**Goal:** `main` deploys to Vercel, migrations apply to the dev project, a seeded event is visible after OTP login.

### T1.1 Scaffold the application ✅
- `pnpm create next-app@latest` with TypeScript, App Router, Tailwind, ESLint, `src` off, import alias `@/*`.
- Add shadcn/ui (`pnpm dlx shadcn@latest init`), lucide, zod, `@supabase/supabase-js`, `@supabase/ssr`, `qrcode`, `html5-qrcode`, vitest, prettier.
- `next/font/google` Barlow Condensed and Source Sans 3 in `app/layout.tsx`, exposed as CSS variables `--font-display` and `--font-body`.
- Copy `public/brand/favicon-src/favicon.ico` → `app/favicon.ico`, `favicon-32x32.png` → `app/icon.png`, and `public/icons/apple-touch-icon.png` → `app/apple-icon.png`. Set `metadata.openGraph.images` to `/og-image.png`.
- `.gitignore`, `.env.example` with every variable from BUILD-SPEC §3, `README.md` with setup steps.
- **Done when:** `pnpm dev` renders a page with the font applied; `pnpm lint && pnpm typecheck && pnpm test` pass with one placeholder test.
- **Verified 20 Sep 2026:** `/` and `/styleguide` render at 200 with Barlow Condensed on headings and Source Sans 3 on body (confirmed from computed styles in the browser, not by eye alone); `pnpm lint`, `pnpm typecheck` and `pnpm test` all pass — 35 real tests rather than a placeholder, because T1.5 landed in the same sitting.
- **Deviations:** pinned Next **15.5.25**, because `create-next-app@latest` now installs 16.x and BUILD-SPEC §2 names 15.x. `next lint` is removed in recent Next, so `pnpm lint` runs `eslint .` directly; BUILD-SPEC §11a updated to match.

### T1.2 Design tokens and brand components ∥ ✅
- `app/globals.css` `@theme` block from DESIGN-SYSTEM §2.2; shadcn variable mapping; `.theme-display` class.
- **Already done:** `scripts/fetch-brand-assets.{sh,ps1}` have been run; the official logo files, watermark, spacing guide and CUT favicon set are in `public/brand/` with `SOURCES.md`. `scripts/generate-derived-assets.py` has produced PWA icons, the OG image, a banner placeholder and six lot placeholders (inventory in DESIGN-SYSTEM §8). Do not re-fetch unless CUT updates its logo.
- `components/brand/Logo.tsx`, `BrandFrame.tsx` using those files.
- `public/manifest.webmanifest` referencing `public/icons/*` (name "CUT Events", short name "CUT Events", theme `#003261`, background `#FFFFFF`, `display: standalone`).
- **Done when:** a `/styleguide` dev-only page shows tokens, type scale, buttons, badges, and both logo variants on light and dark.
- **Verified 20 Sep 2026:** `/styleguide` renders every token, the type scale, buttons, badges, cards, both logo variants on white and on `cut-900` with the plate, and the `.theme-display` projection surface. Computed styles confirm `.theme-display` background `#001738`, card `#003261`, gold `#FBB927`, plate white with 16 px padding and 8 px radius, primary button `#003261`, attendee bid button 56 px tall, projection amount 160 px Barlow Condensed. The page 404s in production builds.
- **Note:** `components/brand/Logo.tsx` draws every size from `logo-h-lg.png` / `logo-v-lg.png` and lets the Next image optimiser produce the density variants. `logo-h-sm.png` is 175 px wide, barely above its own 160 px minimum display size, so using it directly is soft on any 2× screen. The small files stay in `public/brand` for email HTML and favicons, where a fixed URL is required.

### T1.3 Supabase project link and migrations ✅ (dev-project push pending the key)
- `supabase init`, `supabase link --project-ref …`.
- Write migrations `0001`–`0008` exactly as in BUILD-SPEC §4 (fix ordering: `citext` before `contacts`; `auctions_spotlight_fk` after `lots`).
- Verify `realtime.send` works on the project with a one-line test in the SQL editor; if not, implement the polling fallback flag from BUILD-SPEC §4.6 in T3.3/T4.1 and note it here.
- `pnpm db:push` script → `supabase db push`; `pnpm db:types` → `supabase gen types typescript --linked > lib/db/types.ts`.
- **Done when:** `supabase db push` succeeds on a fresh dev project; `lot_state` view returns rows after inserting test data by hand; `select cron.schedule…` is present (or the every-minute fallback is documented in the migration comment).
- **Verified 20 Sep 2026, against a local Supabase Postgres 17.6 stack** (`supabase start`, `supabase db reset`), because the dev project's `sb_secret_…` key and database password have not arrived yet. All eight migrations apply from empty through the same CLI that `db push` uses. The push to the dev project itself is the one check still outstanding.
  - `supabase/tests/01-schema-behaviour.sql` — 20 checks, all passing: `lot_state` on empty and bid-on lots; every `result` value the `/api/checkin` and `/api/bid` contracts promise (`not_checked_in`, `wrong_event`, `invalid`, `already_checked_in`, `too_low`, `lot_closed`, `not_an_attendee`, `ok`); sequential bidder numbers; the event flipping to `live` on first arrival; soft close extending a lot from 89 s to 120 s on a bid inside the window; `close_due_lots` settling a winner and marking the under-reserve lot `unsold`, and being idempotent on a second run; `void_bid` rolling the board back to the previous leader and writing the audit row; the ledger staying append-only.
  - `supabase/tests/02-rls-boundaries.sql` — the RLS matrix as an executable script. `anon` returns 0 rows from every table and is refused `lot_state`, `place_bid`, `check_in_attendee` and `void_bid`. `door_staff` sees its department's events and attendees and nothing else, and cannot create an event. An organiser cannot insert into `bids`, cannot call `place_bid`, and cannot create an event in another department. An organiser of a second department sees only its own event and zero contacts, attendees, lots or bids. All 16 tables have RLS enabled **and forced**, each with at least one policy; zero tables without RLS, zero with RLS but no policy.
  - `realtime_selftest()` returns "realtime.send is available", so the broadcast path works and the `poll` fallback is not needed. This still has to be re-confirmed on the dev project, which may have different realtime settings.
  - `pg_cron` accepted the 30-second schedule; the every-minute fallback in `0007` was not needed locally.
- **Defects found in BUILD-SPEC §4.4 and fixed in both the migration and the spec:**
  - `check_in_attendee` did not run at all. `bidder_number` and `checked_in_at` are OUT parameters, so the bare column references in `max(bidder_number)` and in the `checked_in_count` subquery are ambiguous between the variable and the column, and Postgres refuses the statement. Both are now aliased.
  - `close_due_lots` took `FOR UPDATE OF l` through a join to `lot_state`, a view with a lateral join and an outer join. It now locks `lots` alone and looks the high bid up inside the loop; behaviour is identical.
  - `lot_state` and `auction_totals` are now `security_invoker = on`. A Postgres view runs with its owner's privileges by default, which would have bypassed RLS on `lots`, `bids` and `attendees` and shown the whole board to any authenticated user of any department.
  - Supabase grants `EXECUTE` on new public functions to `anon` and `authenticated`. Every `SECURITY DEFINER` function is now revoked from those roles and granted to `service_role` alone. Without this, anyone with the publishable key could call `place_bid` straight from a browser, which is the one rule CLAUDE.md states outright.
- **Additions beyond the spec listing:** `check_in_attendee` takes `p_event_id` so it can return the `wrong_event` result §7.2 promises; `void_bid`, `set_display_mode`, `log_audit`, `notify_broadcast` and `realtime_selftest` are written out; `check_in_attendee` moves an event from `published` to `live` on the first arrival, which T2.2 asks for.

### T1.4 Supabase clients and staff auth ✅ (dev-project SMTP pending the email key)
- `lib/supabase/{client,server,admin}.ts` per BUILD-SPEC §1; `middleware.ts` refreshing sessions.
- `/login` with email OTP (request code, verify code), `requireStaff(roles)` helper, `/dashboard` placeholder that shows the signed-in profile and role.
- Supabase Auth configuration per BUILD-SPEC §4.9 (custom SMTP via Resend/Brevo, `{{ .Token }}` in the template, redirect URLs, public signups off). Record what was configured in `README.md`.
- `/settings` minimal: platform admin sees users of the department with a role dropdown and an "Invite staff" form (creates the auth user via the admin API and sends a magic link).
- **Done when:** a seeded user receives a code within 30 s, logs in, sees the dashboard; an unauthenticated visit to `/dashboard` redirects to `/login`; a `door_staff` user visiting `/events/new` gets 403; the admin changes a role and the change takes effect on next request.
- **Verified 20 Sep 2026 in a browser against the local stack**, with three real accounts (`admin@`, `organiser@`, `door@demo.cut-events.test`):
  - An unauthenticated `/dashboard` redirects to `/login`.
  - `door@` requested a code, it arrived in Mailpit immediately, and the six digits signed them in to a dashboard that reads "Signed in as door@demo.cut-events.test · Door staff".
  - `door@` visiting `/events/new` and `/settings` gets the 403 page — "You do not have access to this page" — rather than a redirect to `/login`, so a member of staff is never told to sign in again as themselves.
  - `admin@` changed Thabo from door staff to auction operator through the Settings dropdown; `profiles.role` changed and `audit_log` gained a `profile.role_changed` row carrying the actor. Reverted afterwards.
  - The invite form created `lerato.newstaff@example.com` as an organiser through the Auth admin API and, because no email provider is configured, displayed the magic link on screen instead of pretending to have sent it.
  - `pnpm build` is clean; sign-out clears the session cookie and returns to `/login`.
- **Still outstanding:** the same walkthrough on the dev project, which needs its secret key, and custom SMTP, which needs the Resend or Brevo key. Locally the mail goes to Mailpit, so the free-tier mailer limit in BUILD-SPEC §11b has not been exercised.
- **Two defects found and fixed while testing:**
  - The magic-link email carried only a link and no `{{ .Token }}`, so the six-digit code the form asks for was never delivered — exactly the trap BUILD-SPEC §4.9 names. `supabase/templates/magic-link.html` is now a branded CUT template containing both, wired into the local stack through `config.toml`; the dev and production dashboards must be set to match by hand.
  - The sidebar footer was `lg:absolute lg:bottom-0`, which put Sign out in the bottom-left corner underneath the Next dev-tools indicator, where it could not be clicked. It is now a flex column with `mt-auto`.
- **Decisions:** `lib/auth/roles.ts` holds the role names and labels with no server-only import, because `lib/auth/staff.ts` is `server-only` and a client component importing it is a build error. Nav links and action buttons a role cannot use are hidden rather than left to 403 — a control that always fails reads as a bug. `signInWithOtp` passes `shouldCreateUser: false` so a mistyped address cannot silently create an account with no department or role, and a failed request returns the same message whether or not the account exists, so the form cannot be used to enumerate registered addresses.

### T1.5 Token signing library ∥ ✅
- `lib/auth/pass.ts` per BUILD-SPEC §6, constant-time compare.
- `lib/money.ts` with `formatZAR`, `bidStep`, `nextMinBid`.
- Unit tests for both, including the SQL-parity table of cases for `bidStep`.
- **Done when:** tests pass; tampered token returns `null`.
- **Verified 20 Sep 2026:** 35 tests pass. Tampered signature, tampered id, swapped kind prefix, wrong length and malformed input all return `null`; `bidStep` is pinned to the same eleven-case table as the SQL function. Token length is **47** characters, not 46 as BUILD-SPEC §6 implied (1 + 1 + 22 + 1 + 22); the spec's format string is unchanged and correct.

### T1.6 Seed script ✅
- `supabase/seed/seed.ts` per BUILD-SPEC §11 using the admin client and Auth admin API. `pnpm seed`.
- Six lot images already exist at `supabase/seed/lots/lot-{1..6}.jpg` (branded placeholders, 1200×900, ~40 KB each); the seed uploads them to the `lot-images` bucket. Institutional Advancement will supply real photographs before the pilot.
- **Done when:** running twice leaves exactly one demo department, 40 contacts, 1 event, 40 invitations, 28+ attendees (12 checked in with bidder numbers 1–12), 1 auction, 6 lots, seeded bids; the script prints organiser magic link, two pass URLs, display URL.
- **Verified 20 Sep 2026** — run twice back to back, then counted: 1 department, 3 staff profiles, 40 contacts, 1 event, 2 event questions, 40 invitations (28 accepted / 6 declined / 6 pending), 34 rsvps, 35 attendees (28 acceptances plus 7 plus-ones), 12 checked in holding distinct bidder numbers 1–12, 28 consents, 1 auction, 6 lots each with its image, 14 bids, 3 auth users. No duplicates. R20 250 on the board across 5 of 6 lots, with lot 6 left empty so the demo has a first bid to make. All six lot images upload to the `lot-images` bucket and serve publicly (HTTP 200, 40 KB). **7.1 seconds**, against the 2-minute budget in the definition of done.
- **Every seeded bid goes through `place_bid`.** The seed has no shortcut into the ledger because 0005 gives `bids` no insert policy at all, so the seed exercises the same path the bidding page will.
- **Defect found and fixed:** the printed magic links did not work. `auth.admin.generateLink()` returns an `action_link` pointing at Supabase's own `/auth/v1/verify`, which hands the session back in the **URL fragment** — a server component can never read it, so following the link landed on `/login` with no session and no explanation. Links are now built from `properties.hashed_token` against a new `app/auth/confirm/route.ts`, which exchanges the token server-side with `verifyOtp`. Confirmed: the organiser link signs straight in to a dashboard showing the seeded gala, 40 contacts, and the AUCTION and LIVE pills. The staff invitation form in `/settings` was building its link the same wrong way and is fixed too.
- **Note:** contacts live in `supabase/seed/data.ts` with the reasoning in its header — invented names, `@example.com` (RFC 2606, undeliverable) and the `+27 82 000 00xx` block, so nothing here can reach a real person.

### T1.7 CI/CD and hosting ✅ (Vercel link pending)
- `ci.yml`: install, lint, typecheck, test, `supabase db push --dry-run` on PRs.
- `migrate.yml`: `supabase db push` on push to `main` using `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` secrets.
- `keepalive.yml`: weekly `curl` to `/api/cron/keepalive` with the bearer secret; implement the route.
- Vercel project linked to the repo, env vars set, production branch `main`.
- **Done when:** a PR shows green checks; merging deploys; `https://<app>.vercel.app/login` works; keepalive returns 200.
- **Verified 20 Sep 2026:** `/api/cron/keepalive` returns 401 with no header and with a wrong bearer token, and 200 with the right one — `{"ok":true,"database":"awake","ms":84}`, so it really does touch the database rather than just answering. All three workflow files parse. `pnpm build` is clean.
- **Still outstanding, and on Moeketsi:** the repository secrets, the Vercel project link, and therefore the first green run on GitHub. Both workflows that need secrets fail with a named error listing exactly which are missing, rather than an opaque CLI failure.
- **Decision — `ci.yml` does not use `supabase db push --dry-run`.** A dry run needs the linked project's credentials, which a pull request cannot have. The `migrations` job starts a real Supabase stack instead and applies every migration to an empty database of the right Postgres version, which proves more: that the schema builds from nothing on a machine that has never seen it. It then runs both scripts from `supabase/tests/` and fails the build if any table is missing RLS enabled, forced, or a policy — so the rule that matters most cannot regress unnoticed.
- **`vercel.json`** sets `X-Robots-Tag: noindex` and `Referrer-Policy: no-referrer` on `/p/*` and `/rsvp/*`. The signed token in those URLs is the credential, so it must not leak through a `Referer` header or land in a search index.
- **Open, needs an answer:** the Vercel function region. BUILD-SPEC §11b wants `cpt1` when Supabase is in an African or European region, but pairing a Cape Town function with a US database would be worse than the default, so no region is set until the dev project's region is confirmed.

### T1.8 Provider applications (user, in parallel)
- Create Resend account and verify domain (or Brevo). Create Meta app, add test recipients. Create Yoco sandbox. Record all values in Vercel and `.env.local`.
- **Done when:** a test email, a test WhatsApp "hello_world" template message, and a Yoco sandbox checkout each succeed from a scratch script `scripts/smoke-providers.ts`.

---

## Week 2 — Invite → RSVP → Pass → Scan

**Goal:** an organiser imports contacts, creates an event, sends invitations, a guest RSVPs, receives a QR pass, and is scanned in at the door.

### T2.1 Contacts ✅
- `/contacts` list with search, tag filter, pagination (50/page).
- CSV import dialog: paste or upload; columns `first_name,last_name,email,phone,organisation,tags,alumni_year`; preview; `importContacts` action with de-dupe by email then phone; phone normalised to E.164 (`0821234567` → `+27821234567`).
- Unit tests for parsing and normalisation.
- **Done when:** importing the same CSV twice reports 0 inserted on the second run; malformed rows are listed with line numbers.
- **Verified 20 Sep 2026, in the browser against the local stack.** A five-row CSV (two new people, one already on the list, one with no first name, one with `banana` in the phone column) previewed as "3 rows ready, 2 to fix" with `Line 5 — first_name is blank` and `Line 6 — "banana" is not a phone number we can read`, then imported as **Added 2 · Updated 1 · Unchanged 0**. The identical CSV imported again reported **Added 0 · Updated 0 · Unchanged 3** with the same two line errors, which is the "0 inserted on the second run" check. Search matched on name, email and organisation; a search containing `'),or(` came back as 0 results rather than a PostgREST syntax error; the tag chips filtered and composed with the search; pagination (temporarily at 10/page to exercise it) showed `21–30 of 40`, kept the filter across pages, disabled Next on the last page, and a bookmarked `?page=9` redirected to the last real page. 18 new unit tests cover the CSV reader and phone normalisation. No console errors.
- **Decisions taken where the task was silent:** a row needs an email address *or* a phone number, because a row with neither cannot be de-duplicated and would be created again on every import. A contact that already exists is **enriched, not replaced** — a blank cell never erases a stored value and tags are merged — since an organiser's second spreadsheet is usually partial. Tags are lowercased on the way in so the filter chips do not split `Donor` from `donor`. A row whose email matches one contact and whose phone matches another is refused with an explanation rather than silently merging two donor records. The import writes an `audit_log` row (`contacts.imported`), which needed migration `0009` to let `log_audit` take a null `entity_id`: a bulk act has no single row to point at.

### T2.2 Events CRUD ✅
- `/events` list grouped by status; `/events/new` form; `/events/[id]` overview with funnel tiles (invited, accepted, declined, pending, checked in) and quick links; edit dialog; banner upload to `event-banners`.
- Status transitions: draft → published → live → closed. `live` is set manually or automatically when the first check-in happens.
- **Done when:** an organiser creates an event, uploads a banner, and sees it in the list; a door-staff user sees the event but no edit controls.
- **Verified 20 Sep 2026, in the browser against the local stack.** Signed in as the organiser, created "Alumni Winter Lecture (Test)" through `/events/new` (18:30 start, 21:00 end, RSVP deadline 5 November 17:00, capacity 120); it redirected to the new overview and appeared on `/events` under **Upcoming** as a ticket reading `THU 12 NOV · PUBLISHED · 120 seats`. Pressed **Publish**: the pill changed to `published`, the notice read "The event is now published", and the next options became *Open the doors* and *Return to draft*. Uploaded a banner through the real client path (browser resize → Server Action → `event-banners` bucket): the object landed at `{eventId}/{timestamp}.jpg`, `events.banner_url` was set, and `next/image` optimised it (HTTP 200, 27 KB). The edit dialog pre-filled **18:00**, not 16:00 — the SAST round-trip that `toISOString().slice(0,16)` would get wrong — and a save that changed only the venue left `starts_at` at 18:00 SAST in the database. An RSVP deadline set after the start was refused with "The RSVP deadline has to fall before the event begins."
  Then signed in as **door staff** (`door@…`, OTP read from the local mail catcher) and opened the same event: the page renders, but there is no Edit button, no status buttons, no banner upload, no Broadcast or Auction console button in the hero, and no Contacts link in the sidebar. The only interactive elements are the sidebar, "All events" and "Open the scanner".
  The page below the hero was verified from the DOM and one full-height screenshot; the browser pane paints only the top of a page while it is hidden behind another window, so scrolled screenshots came back blank. The seeded event and the test data were restored afterwards.
- **Decisions taken where the task was silent:** the overview has no page header of its own — the hero *is* the header, since DESIGN-SYSTEM §2.4 allows one dramatic element per page and a `PageHeader` above it would print the event title twice. `EventHero` gained a `showOverviewLink` prop so it does not link to the page it is on. The funnel is a five-column `Ledger` (invited · accepted · declined · no reply · arrived), not stat tiles, per the v3 card vocabulary; declined and "no reply" carry no drawing because neither has an honest one. Door staff get a one-line desk pointing at the scanner instead of the organiser's seven links, on StaffShell's rule that a link ending in a 403 is worse than no link. `published → draft` is allowed as a retraction; nothing returns from `live`, because arrivals have happened. `/events/new` gained description, end time, RSVP deadline and address so an event is RSVP-ready without a second trip through the edit dialog.
- **Defect found and fixed:** `next.config.ts` hard-coded `protocol: 'https'` in the `images.remotePatterns` entry, so `next/image` refused every image served by the local Supabase stack, which is `http://127.0.0.1:54521`. The protocol and port now come from `NEXT_PUBLIC_SUPABASE_URL` alongside the hostname. This would have hidden every banner and lot photo in local development.

### T2.3 Guest list and invitations ✅
- `/events/[id]/guests`: contact picker with the same filters as `/contacts`, "Add to event" creates `invitations` with signed `r.` tokens; table of invitees with status and channel history; remove invitee (only while `pending`).
- `/events/[id]/invitations`: template preview with merge fields (`{{first_name}}`, `{{event_title}}`, `{{rsvp_url}}`, `{{starts_at}}`, `{{venue}}`), channel checkboxes (email, WhatsApp), recipient filter (all pending / selected), send button with count confirmation.
- Messaging layer `lib/messaging/*` per BUILD-SPEC §8 with `invite` and `pass` templates; Resend and Meta implementations; `message_deliveries` written for each recipient.
- Resend webhook route updating statuses and `opened_at`.
- **Done when:** sending to 3 test contacts creates 3 delivery rows that move to `sent`, the email renders correctly in Gmail and Outlook web, and the WhatsApp text arrives on a test phone.
- **Verified 20 Sep 2026, in the browser against the local stack, except the parts that need provider keys.** The guest list shows all 40 invitations with reply status, the channels each was sent through and whether it was opened. Removing a pending guest took the list from 40 to 39 and moved them into the picker; adding them back took it to 40 and wrote an invitation whose `r.` token verifies against `PASS_SIGNING_SECRET` and resolves to that invitation's own id. The composer previews the real rendered email in a sandboxed iframe with a real guest's merge fields resolved, and the WhatsApp rendering beside it. Audience counts read 6 not-yet-sent, 6 yet-to-reply, 40 everyone, with per-channel reach (6 have an email address, 4 have a number and an opt-in). Pressing **Send 6 messages** with no provider configured produced exactly the graceful failure the brief asks for: **6 `message_deliveries` rows at `failed / not_configured`**, each named in the report, the delivery log showing them, and **no invitation falsely marked as sent** (`first_sent_at` stayed at 34). `pnpm seed` still rebuilds the demo in about 5 seconds.
- **Could not perform without keys, and why:** the "3 delivery rows move to `sent`", "renders correctly in Gmail and Outlook web" and "arrives on a test phone" checks need the Resend API key and the Meta test-number credentials. The code path is complete and exercised up to the provider call; the moment the keys land these are a ten-minute check. The Resend webhook likewise cannot be exercised from a laptop, because Resend has to reach a public URL — a `cloudflared` tunnel or the Vercel deployment. Its signature verification *is* tested, in `tests/unit/messaging.test.ts`.
- **Decisions taken where the task was silent:** the invitation `r.` token is minted with the row rather than written back afterwards, so no window exists in which an invitation has no usable link. A send never re-signs: the link already in a guest's inbox stays valid. WhatsApp goes only to contacts with `whatsapp_opt_in`, which Meta requires and POPIA obliges us to be able to evidence. A guest is skipped, and reported, rather than failed, when they have no address on a chosen channel. `sent_via` accumulates rather than replaces, so an invitation emailed on Monday and WhatsApped on Tuesday reads as both. Removal is allowed only while the invitation is `pending`; once someone has replied there are attendees and passes behind the row, and a silent delete would leave a pass the door cannot explain. The status pill learned the invitation and lot vocabularies so one component covers every state in the console.
- **Demo addresses:** `pnpm seed` now honours `DEMO_EMAIL_BASE` and `DEMO_PHONES`. Resend's free tier with no verified domain delivers only to the account owner, so setting `DEMO_EMAIL_BASE=you@gmail.com` gives the first five seeded guests `you+naledi@gmail.com` and so on — distinct addresses to the database's unique index, one inbox to put on the projector — while the other 35 stay `@example.com` so nothing undeliverable is attempted and the no-real-personal-data rule holds. `DEMO_PHONES` does the same for the five numbers registered as WhatsApp test recipients, and opts those guests in. Both are documented in `.env.example`.

### T2.4 RSVP page ✅
- `/rsvp/[token]`: verify token, load invitation + event; if `rsvp_deadline` passed show a closed message; form per BUILD-SPEC §7.3 including plus-one names when allowed and the consent checkbox (wording `v1`).
- Submit: upsert `rsvps`, set `invitations.status`, create `attendees` (one per guest) with signed `p.` tokens, insert `consents`, send `pass` message by email and WhatsApp (if opted in), render success with pass link and "Add to calendar" `.ics`.
- Declining shows a courteous message and no pass.
- Capacity rule: accepted seats = sum of `rsvps.guest_count` over invitations with status `accepted`; if that plus the new request exceeds `events.capacity`, the invitation becomes `waitlisted`, no attendees are created, and the page says so. Declining or reducing guests frees seats; the organiser promotes waitlisted guests manually in the POC.
- **Done when:** accepting creates attendees and sends the pass; revisiting the link shows the current answer and allows changing it until the deadline; capacity reached puts new acceptances on `waitlisted`.
- **Verified 20 Sep 2026, in the browser against the local stack.** Opened a real pending invitation: the page renders on the cinematic layer (ballroom of light, glass panel, gold selection) with the guest's first name, the event, the deadline and the two custom questions from the seed. Accepted with **2 seats, a named plus-one and dietary "Vegetarian"**, and the database then held: the invitation `accepted`, an `rsvps` row with `guest_count 2` and the answer keyed by question id, **two `attendees`** (the guest and `Palesa Kgosi`) each with a signed `p.` token, **two `consents`** rows (`event_comms/email` and `whatsapp/whatsapp`, both `wording_version v1`, `source rsvp_form`), the pass QR PNG in the `passes` bucket, and two `pass` deliveries recorded `failed / not_configured` because no provider has keys yet. Revisiting the link showed "You have already replied yes", the seats and dietary answer as given, a link to the pass already issued, and a **Change my reply** button. Changing to one seat **removed the surplus plus-one and left the primary pass token untouched**, so the link already in the guest's hands still works. With capacity set to exactly the seats taken, the next acceptance came back **"You are on the waiting list"** and created **no attendees**. Declining returned the regret copy and released the seats. With the deadline moved into the past the form is replaced by "Replies have closed" plus, for a guest who had accepted, their pass link. `/rsvp/<token>/event.ics` returns valid RFC 5545 with CRLF endings, 75-octet folding, escaped commas and `DTSTART:20261030T160000Z` — 18:00 SAST — and a tampered token 404s. 9 new unit tests cover the calendar builder. No console errors. State restored with `pnpm seed`.
- **Decisions taken where the task was silent:** an attendee already through the door is never deleted by a later change of answer — declining or shrinking the party removes only attendees with `checked_in_at is null`, because someone standing in the room is in the room whatever the form now says. Capacity counts seats on every *other* accepted invitation, so re-submitting the same answer cannot push a guest over their own head and reducing a party frees seats immediately. Consent is appended, never edited: a ledger is a history, and the version of the wording that was on screen is stored with each row. The contact's `whatsapp_opt_in` follows the latest answer in both directions, since that flag is what the broadcast desk reads. Plus-one names are optional and default to "Guest of {firstName}", which is what the door needs to hear. Only the primary guest is emailed the pass; plus-ones arrive with their host, so their passes exist but are not sent anywhere.

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
