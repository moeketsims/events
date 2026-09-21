# 07 — Implementation plan: self-registration by QR, and WhatsApp moved last

For the implementing agent picking up after the Week 3 review fixes (`main` at `12b20a2`). Everything here is derived from `docs/01-BUILD-SPEC.md`, `docs/02-DESIGN-SYSTEM.md`, `docs/03-TASKS.md`, `docs/06-IMPLEMENTATION-PLAN-WEEKS-3-4.md` and the code as it stands. Where this plan and the spec disagree, the spec wins on technical matters and `PLAN.md` wins on scope; note the disagreement in the commit body. Read `CLAUDE.md` first.

This plan adds one task, **T3.6 Self-registration**, to be built **before T4.1**, and moves everything that needs Meta's WhatsApp credentials to a new final task, **T4.6 WhatsApp**. Nothing else in the Week 4 order changes.

---

## 0. The decisions, already taken by Moeketsi on 21 September 2026

1. **WhatsApp is the last piece of functionality.** Every WhatsApp path already fails gracefully with `not_configured` and is recorded that way. Do not touch the Meta provider, the WhatsApp webhook, the broadcast WhatsApp checkbox or the pass-message WhatsApp send. They stay as they are until T4.6.
2. **A guest can register themselves in the room.** One QR code per event, printed at the door and on the tables, opens a public page. The guest gives first name, surname and email, ticks the consent, and submits.
3. **Registration checks the guest in and assigns their bidder number at once**, exactly as the staff walk-in does today. The QR exists only inside the venue, so scanning it is proof of arrival. There is no second step at the door.
4. **The pass link is shown on screen immediately and emailed as a copy.** The screen is the guarantee; the email is the convenience. Resend's free tier delivers only to the account owner's Gmail and its `+` aliases until a domain is verified, so a real guest at the gala must never depend on the email arriving.
5. **A guest who already has a pass for the event gets that pass back**, not a second attendee row. Matching is by email within the department, the same as the walk-in route.
6. **Everything is built and verified against the local Docker stack.** No hosted project, no Vercel, no provider key is a prerequisite for this task.

---

## 1. What exists and must be reused, not rebuilt

| Need | What exists | Where |
|---|---|---|
| Create a contact, an attendee, a consent row, then check in and assign a bidder number | The staff walk-in route does all of it, in this order: match contact by email then phone → insert or update contact → insert `event_comms` consent (+ `whatsapp` when opted in) → find existing non-plus-one attendee for this contact and event, else insert one with a signed `p.` token → `check_in_attendee` RPC → `storePassPng` → return `passUrl`. | `app/api/walkin/route.ts` |
| Bidder number assignment, serialised per event, and the `checkin` realtime event | `check_in_attendee(p_attendee_id, p_staff_id, p_event_id)`. `p_staff_id` may be `null`: `attendees.checked_in_by` is nullable and the schema tests already call it with `null`. | `supabase/migrations/0004_functions.sql` lines 123–184; `supabase/tests/01-schema-behaviour.sql` line 36 |
| Signed tokens | `signToken(kind, uuid)`, `verifyTokenOfKind(token, kind)`, `newTokenId()`; kinds `'p'` and `'r'`. | `lib/auth/pass.ts` |
| The pass email | `send({ kind: 'pass', channel: 'email', … })` with `TemplateData` `{ firstName, lastName, eventTitle, startsAt, venue, passUrl, qrImageUrl }`; writes a `message_deliveries` row first and returns `failed / not_configured` without keys. The RSVP action is the reference call. | `lib/messaging/index.ts`; `app/rsvp/[token]/actions.ts` lines 266–290 |
| QR rendering | `passQrSvg(token)` renders the pass QR inline; `QRCode.toString` with the same options renders any URL. `passUrl(token)`. `APP_URL` from `lib/env.ts`. | `lib/qr.ts` |
| Consent wording and versions | `consentWording()`, `CONSENT_VERSION`, `CONSENT_PURPOSE.eventComms`, `CONSENT_SOURCE`. | `lib/consent.ts` |
| The public, token-authenticated page pattern | `/rsvp/[token]`: `Atmosphere` at 0.6, `Logo` plate, `.glass-panel`, `.input-dark`, gold button, Server Action `(prev, formData)` with zod, `robots: noindex`, admin client reads only the listed columns, `notFound()` on a bad token. | `app/rsvp/[token]/page.tsx`, `RsvpForm.tsx`, `actions.ts` |
| The success state that shows the pass link | `RsvpForm.tsx` lines 410–440: "Open your pass" button to `/p/<token>` and the sentence about where it was also sent. | `app/rsvp/[token]/RsvpForm.tsx` |
| Console patterns | `StaffShell`, `SectionHeading`, `.card`, `Desk`, `EditEventDialog` for organiser-only controls; Server Actions start with `requireStaff(['organiser'])` then `schema.safeParse`. | `components/staff/*`, `app/(staff)/events/[eventId]/actions.ts` |
| Audit | `log_audit(p_actor_id, p_action, p_entity, p_entity_id, p_metadata)` via the admin client. | `supabase/migrations/0009_log_audit_bulk.sql` |
| Seed | `seedEvent()` inserts the event; the summary at the end prints the display key and staff links. | `supabase/seed/seed.ts` lines 295–320 and 600–695 |
| Unit test style | Vitest, `tests/unit/*.test.ts`, `@/` imports, `process.env.PASS_SIGNING_SECRET ??=` before a dynamic import of the token library. | `tests/unit/pass-token.test.ts` |

**Conventions that apply here, from `docs/06` §0:** attendee-facing and public server code uses `createAdminClient()` and selects only the columns the spec lists; Server Actions take `(prev, formData)` and return `{ error?, result? }` for `useActionState`; never run `next build` while `pnpm dev` is up (use `pnpm build:check`); after any migration run `pnpm db:types:local` and commit `lib/db/types.ts`.

---

## 2. Design of T3.6

### 2.1 The join token

A new token kind **`'j'`** in `lib/auth/pass.ts`, signed over the **event id**: `j.<id22>.<sig22>`, 47 characters, same HMAC and secret as the others.

A signature over the event id alone would be permanent: once printed, it could never be withdrawn without rotating `PASS_SIGNING_SECRET` and every pass with it. So the token is **also stored on the event** and must match the row, the same rule that makes a reissued pass revoke the old link. Regenerating it invalidates every printed QR for that event and nothing else.

Because the id inside the token is the event id, a regenerated token has the same id and a **different signature only if the signed input differs**. So the signed input for kind `'j'` is `j.<id22>.<nonce>` where the nonce is a fresh `newTokenId()` stored beside it. Concretely:

- `events.join_token text unique null` — the full token string, or null when self-registration is off.
- `events.join_nonce uuid null` — the nonce the signature covers.
- `signJoinToken(eventId, nonce)` → `j.<id22(eventId)>.<sig22 over "j." + id22 + "." + nonce>`.
- `verifyJoinToken(token)` → `{ eventId, sig }` after a shape check only (three parts, lengths 22/22, kind `j`). The signature **cannot** be verified without the nonce, which lives on the row, so verification is two steps: parse → load the event by id → recompute with the row's nonce → constant-time compare → also require `token === events.join_token`. Put both steps in one helper `resolveJoinToken(admin, token)` in `lib/auth/join.ts` that returns the event row or `null`.

Do not extend `verifyToken` to accept `'j'`; its callers assume the signature is self-contained. Add the new kind as its own small module.

### 2.2 Routes

| Route | Kind | Auth | Purpose |
|---|---|---|---|
| `/join/[token]` | public page, server component + client form | join token in the path, resolved against the row | The registration form. |
| `joinEvent` Server Action in `app/join/[token]/actions.ts` | `(prev, formData)` | the token in a hidden field, resolved again | Creates or matches the contact, creates or finds the attendee, checks in, sends the email, returns the pass path. |
| `/events/[id]/join` (console) | staff page | `requireStaff(['organiser'])` | Shows the QR and the link, prints it, turns self-registration on and off, regenerates the token. |
| `setSelfRegistration` Server Action in `app/(staff)/events/[eventId]/join/actions.ts` | `(prev, formData)` | `requireStaff(['organiser'])` | `enable`, `disable`, `regenerate`. Writes an audit row. |
| `/events/[id]/join/print` | staff page | `requireStaff(['organiser'])` | An A4 sheet: the QR, the event title, "Scan to join tonight", the URL in text. `@media print` only; no console chrome. |

`/join` is **not** in the middleware matcher and must not be added: it needs no session and no cookie, and every request re-resolves the token. Add the same `X-Robots-Tag: noindex, nofollow` and `Referrer-Policy: no-referrer` headers for `/join/(.*)` to `vercel.json`, matching `/rsvp`.

### 2.3 The public page `/join/[token]`

Server component. `resolveJoinToken(admin, token)`; `notFound()` on null. Then select from `events` only `id, title, starts_at, venue_name, status, auction_enabled`. If `status` is not `published` or `live`, render the page with a closed message ("Registration for this event is closed.") and no form. Do not reveal any count, amount, lot or other guest. `metadata.robots = { index: false, follow: false }`.

Layout follows `/rsvp/[token]`: `Atmosphere intensity={0.6}`, the white logo plate linking nowhere, an eyebrow "You are here", the event title as the headline (one line white, one line `.text-gold-metallic` if it wraps naturally, otherwise white), the date via `formatEventDate` and the venue with the `CalendarDays` and `MapPin` icons, then the form in a `.glass-panel`. Max width 480 px, 16 px gutters, no horizontal scroll at 360 px.

**Form fields, in this order, all `.input-dark`:**

1. First name (required, max 80)
2. Surname (required, max 80)
3. Email (required, `z.email()`, lower-cased on the server)
4. Consent checkbox with `consentWording()` exactly, required. Label text for the tick: "I agree".
5. A hidden `website` text field, visually hidden and `tabIndex={-1}`, `autoComplete="off"`; if it arrives non-empty the action returns success without writing anything (a honeypot for bots; the guest never sees it).
6. Hidden `token`.

Button: `gold` variant, 48 px, "Register and get my pass". Pending label "One moment…".

No phone field and no WhatsApp opt-in on this form. WhatsApp is T4.6, and a guest at a table should type three things, not five.

**Success state**, replacing the form in the same panel:

- Heading: "You are checked in, {firstName}." (copy rule: second person, first name only).
- If `auction_enabled` and a bidder number came back: the gold badge "Bidder 042" using `formatBidderNumber`, and the line "Your bidder number for tonight."
- The primary button "Open your pass" → `/p/<token>` (relative path, as the RSVP success does).
- Below it, the pass URL as selectable text, `break-all`, because a guest may want to copy it into a note.
- One sentence about the email: "We have also emailed it to {email}." when `sent.email` is true; "Keep this page open; the link above is your pass." when it is false. Never say the email failed.
- If the guest already had a pass (the action's `outcome` is `existing`): heading "Welcome back, {firstName}." and the same button. If they were already checked in, no new number is assigned and the existing one is shown.

### 2.4 The action `joinEvent`

```ts
const schema = z.object({
  token: z.string().min(40).max(60),
  firstName: z.string().trim().min(1, 'Your first name is needed.').max(80),
  lastName: z.string().trim().min(1, 'Your surname is needed.').max(80),
  email: z.email('That email address could not be read.'),
  consent: z.literal(true, { message: 'Please tick the box so we may keep your details.' }),
  website: z.string().max(200).optional(),   // honeypot
});
```

Steps, in this order. Every database call is through `createAdminClient()`.

1. Parse. On failure return `{ error }` with the first issue's message.
2. Honeypot: if `website` is non-empty, return `{ result: { outcome: 'ignored' } }` and stop. The client renders that as the success panel with no pass link and the heading "Thank you." Nothing is written and nothing is logged.
3. Rate limit: 5 submissions per 10 minutes per client IP, in memory, same pattern as `/api/bid`'s map (read `x-forwarded-for` first, then `x-real-ip`, else `'unknown'`). Over the limit return `{ error: 'Too many attempts from this connection. Ask a member of staff at the door.' }`.
4. `resolveJoinToken`. Null → `{ error: 'This code is not valid. Ask a member of staff at the door.' }`.
5. Event must be `published` or `live`; otherwise `{ error: 'Registration for this event is closed.' }`.
6. Lower-case the email. Match a contact by `(department_id, email)`. If found, do **not** overwrite its name (the invitee may have spelled it the way they prefer); if not found, insert `{ department_id, first_name, last_name, email, tags: ['walk-in', 'self-registered'] }`.
7. Insert one `consents` row `{ contact_id, purpose: 'event_comms', channel: 'email', wording_version: CONSENT_VERSION, source: 'self_registration' }`. Add `selfRegistration: 'self_registration'` to `CONSENT_SOURCE` in `lib/consent.ts`; `consents.source` is free text, so no migration is needed for it.
8. Find the existing attendee for `(event_id, contact_id, is_plus_one = false)`. If none, insert `{ id: newTokenId(), event_id, contact_id, display_name: "First Last", is_walk_in: true, pass_token: signToken('p', id) }`.
9. Call `check_in_attendee(p_attendee_id, p_staff_id: null, p_event_id)`. Take `result`, `bidder_number`, `checked_in_at` from the row. `already_checked_in` is not an error.
10. `storePassPng(attendeeId, passToken)`; then `send({ kind: 'pass', channel: 'email', eventId, contactId, attendeeId, to: { email }, data: { firstName, lastName, eventTitle, startsAt: formatEventDate(starts_at), venue: venue_name ?? '', passUrl: passUrl(passToken), qrImageUrl } })`. A failed send is recorded by the messaging layer and does not fail the action.
11. `log_audit(null, 'attendee.self_registered', 'attendee', attendeeId, { event_id, outcome, bidder_number })`. `log_audit`'s actor is nullable.
12. Return `{ result: { outcome: 'registered' | 'existing', firstName, bidderNumber, passPath: '/p/<token>', passUrl, sent: { email } } }`.

The response carries the guest's own first name and their own pass. It never carries another guest, a count or an amount.

### 2.5 The console page `/events/[id]/join`

Organiser only. Add a `Desk` row on the event overview between "Attendance register" and "Broadcast desk":

- title "Self-registration QR", description "Print the code guests scan to register and check in at a table.". Always shown; it is useful for any event, not only an auction.

The page, inside `StaffShell` with the usual "← Event" link and `SectionHeading`:

- **When `join_token` is null:** a `.card` with the explanation ("Guests who scan this code register themselves, are checked in and, for an auction, get a bidder number. It only works while the event is published or live.") and one button "Turn on self-registration" → `setSelfRegistration` with `intent=enable`.
- **When set:** a two-column card at ≥ 768 px, stacked below. Left: the QR as inline SVG (`QRCode.toString(joinUrl, { type:'svg', errorCorrectionLevel:'M', margin:1, color:{dark:'#001738', light:'#FFFFFF'} })`), 240 px, on a white plate with the `cut-900` 4 px frame per DESIGN-SYSTEM §5.2. Right: the URL as selectable text, a "Print sheet" link to `/events/[id]/join/print` (`target="_blank"`), a "Copy link" button (client, `navigator.clipboard`), then a hairline and two secondary actions: "Regenerate code" (`intent=regenerate`, with a confirm step in the same two-press pattern as the broadcast composer: "Every printed code stops working. Print the new one before the event.") and "Turn off" (`intent=disable`).
- A `Ledger` with two figures: "Self-registered" (count of attendees where `is_walk_in and checked_in_by is null`) and "Tonight's arrivals" (all checked in). No amounts.

`setSelfRegistration` action:

```ts
const schema = z.object({ eventId: z.uuid(), intent: z.enum(['enable','disable','regenerate']) });
```

`requireStaff(['organiser'])`; load the event through the **session** client so RLS confines it to the department; `enable` and `regenerate` set `join_nonce = newTokenId()` and `join_token = signJoinToken(eventId, nonce)`; `disable` sets both to null. The update goes through the session client too (the organiser's RLS update policy on `events` allows it). Then `log_audit(profile.id, 'event.self_registration.' + intent, 'event', eventId, {})` through the admin client, and `revalidatePath` for the join page and the event overview.

The **print sheet** is a server component with no `StaffShell`: A4 portrait, the CUT horizontal logo top-left, the event title in Barlow Condensed, "Scan to register and check in", the QR at 120 mm, the URL under it in 14 pt, and the line "Central University of Technology, Free State · Institutional Advancement" at the foot. Use a `<style>` block with `@page { size: A4; margin: 20mm }` and `@media print { .no-print { display: none } }`; one "Print" button with `.no-print` that calls `window.print()` (a tiny client component). The sheet is what goes on the tables.

### 2.6 Migration `0010_self_registration.sql`

```sql
-- 0010 — self-registration by event QR (docs/07)
alter table events
  add column if not exists join_token text unique,
  add column if not exists join_nonce uuid;
comment on column events.join_token is 'Signed j. token printed on the event QR; null = self-registration off. Regenerating it revokes every printed code.';
```

No new policies: `events` already has select for the department and update for organisers, and the public page reads through the admin client. `attendees.checked_in_by` is already nullable. Extend `supabase/tests/01-schema-behaviour.sql` with one block: set `join_token`/`join_nonce` on the fixture event, assert the unique constraint rejects the same token on a second event, and assert `check_in_attendee(..., null, ...)` on a fresh walk-in attendee assigns the next bidder number (it already does; the assertion pins it for this path). Run `supabase db reset` locally, then `pnpm db:types:local`, and commit `lib/db/types.ts`.

### 2.7 Seed

In `seedEvent()`, after the insert, set `join_nonce` and `join_token` on the demo event using the same helper (`supabase/seed/seed.ts` already imports from `lib/`; import `signJoinToken` from `@/lib/auth/join`). Print the join URL in the final summary under a heading "SELF-REGISTRATION QR" next to the display key, so a rehearsal can open it on a phone without a query.

### 2.8 Feature flag

Add `selfRegistration: true` to `lib/features.ts` with its comment line (`selfRegistration T3.6 /join/[token] and /events/[id]/join`). The desk row uses `soon('selfRegistration')` like the others, so the pattern stays uniform even though it lands built.

### 2.9 Files to create and change

Create:

- `lib/auth/join.ts` — `signJoinToken`, `parseJoinToken`, `resolveJoinToken`, `joinUrl(token)`.
- `app/join/[token]/page.tsx`, `JoinForm.tsx` (client), `actions.ts` (`'use server'`).
- `app/(staff)/events/[eventId]/join/page.tsx`, `JoinControls.tsx` (client: copy, confirm-regenerate, the three buttons), `actions.ts`.
- `app/(staff)/events/[eventId]/join/print/page.tsx`, `PrintButton.tsx`.
- `supabase/migrations/0010_self_registration.sql`.
- `tests/unit/join-token.test.ts`.

Change:

- `lib/consent.ts` — add `CONSENT_SOURCE.selfRegistration`.
- `lib/features.ts` — add the flag.
- `app/(staff)/events/[eventId]/page.tsx` — the desk row.
- `supabase/seed/seed.ts` — the token and the summary line.
- `supabase/tests/01-schema-behaviour.sql` — the new block.
- `vercel.json` — the `/join/(.*)` headers.
- `lib/db/types.ts` — regenerated.
- `docs/01-BUILD-SPEC.md` — add `/join/[token]` to the public routes table (§7.3) and `/events/[id]/join` to the console table, with one line each; add `join_token`/`join_nonce` to the `events` DDL in §4.
- `docs/03-TASKS.md` — insert T3.6 (§4 below) and T4.6, tick when done with the "Done when" evidence, as every task does.
- `docs/04-DEMO-SCRIPT.md` — in the check-in beat, replace "Walk-in tab: add a fictitious guest in 20 seconds" with the guest scanning the table QR on Phone 2, registering, and seeing their bidder number; keep the usher walk-in as the recovery move.

Do **not** change: `app/api/walkin/route.ts`, `check_in_attendee`, `lib/auth/pass.ts` beyond exporting nothing new (the join module imports its internals through a small exported `signRaw(input)`; add that one function to `pass.ts` and nothing else), any WhatsApp file, `/api/bid`.

### 2.10 Tests

`tests/unit/join-token.test.ts`:

- round-trips a join token: `parseJoinToken(signJoinToken(EVENT, NONCE))` gives the event id.
- a different nonce gives a different signature for the same event.
- a token with one signature character changed does not verify against the nonce.
- a `p.` or `r.` token is rejected by `parseJoinToken`.
- `joinUrl` is `${APP_URL}/join/${token}`.

`resolveJoinToken` needs a database; it is covered by the schema test block and by the browser check below, not by a unit test with a mocked client.

Also add to `tests/unit/consent.test.ts` (new, small): `CONSENT_SOURCE.selfRegistration === 'self_registration'` and `consentWording()` is the v1 text verbatim. Cheap, and it pins the copy the POPIA record depends on.

### 2.11 Done when (perform every one, in the browser, against the local stack, and write the evidence into `docs/03-TASKS.md`)

1. `pnpm lint && pnpm typecheck && pnpm test` pass; `supabase db reset` applies 0001–0010 from empty and the schema tests pass.
2. Signed in as the organiser, the event overview shows the "Self-registration QR" row; the join page turns it on; the QR renders; "Copy link" works; the print sheet opens and `window.print()` shows one A4 page in the print preview with the QR at 120 mm.
3. Opening the join URL in a private window with **no** session shows the event and the form, with no count, amount, lot or other guest on the page (assert with `get_page_text`).
4. Submitting first name, surname, a `+` alias of `DEMO_EMAIL_BASE` (or any `@example.com` address when unset) and the consent tick returns the success panel within 2 s with "You are checked in, {name}." and a bidder number equal to the previous maximum for the event plus one (check with `select max(bidder_number) from attendees where event_id = …` before and after).
5. Rows exist: one `contacts` row tagged `self-registered`, one `consents` row `event_comms / v1 / self_registration / email`, one `attendees` row `is_walk_in = true, checked_in_by = null, checked_in_at` set, one `message_deliveries` row `kind = pass, channel = email` (status `sent` when Resend is configured, `failed / not_configured` otherwise), one `audit_log` row `attendee.self_registered`.
6. The attendance register page shows the new arrival live (the `checkin` event fires from `check_in_attendee`) and the dashboard count moves without a reload.
7. "Open your pass" opens `/p/<token>` with the bidder badge and the auction link; placing a bid on an open lot from that pass works and is refused with `too_low` below the minimum (the guest is checked in, so `not_checked_in` must not appear).
8. Submitting the same email again returns "Welcome back", the same pass link, the same bidder number, and creates no second attendee, contact or consent row.
9. Submitting with the honeypot filled (set it with `javascript_tool`) returns the "Thank you." panel and writes nothing.
10. Six submissions in a minute from one connection: the sixth returns the rate-limit sentence.
11. Regenerating the code from the console makes the old URL 404 and the new one work; turning it off makes the new one 404 too; turning it on again issues a fresh one.
12. Setting the event to `closed` by SQL makes the join page show "Registration for this event is closed." and the action refuse with the same sentence.
13. Rules audit for the new files: every action validates with zod; the staff actions call `requireStaff(['organiser'])`; the public page and action use the admin client and select only the listed columns; no surname of any other person appears on the public page; the response of `joinEvent` carries only the guest's own data; `grep -rn "last_name" app/join` finds only the form field and the contact insert.

---

## 3. T4.6 WhatsApp, the last task

Everything below already exists in code and is switched off by the absence of keys. T4.6 is verification and the two small pieces that were deferred, not a build.

**Prerequisites, all on Moeketsi:** Meta for Developers app with the WhatsApp test number, `WHATSAPP_PHONE_NUMBER_ID`, a temporary access token, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, and the demo phones added as test recipients; a public HTTPS URL for the webhook (`cloudflared tunnel --url http://localhost:3000` is enough, per the environment memory; Vercel also works).

Steps:

1. Put the keys in `.env.local`; restart `pnpm dev`; confirm `channelReadiness().whatsapp` is true on the broadcast composer (the gold warning changes to the "five phones, 24 hours" sentence).
2. Register the webhook URL in the Meta app; complete the GET handshake; send one broadcast with WhatsApp ticked to "everyone in the room"; confirm the row moves `queued → sent → delivered` from the status webhook.
3. Send a pass by WhatsApp from the RSVP flow for a seeded guest with a demo phone; confirm the QR image arrives.
4. Confirm the `outbid` and `winner` templates render on WhatsApp for one real outbid and one closed lot.
5. Optional, only if time remains: add a phone field and the WhatsApp opt-in to `/join/[token]` under the email, with `normalisePhone` and a second `consents` row, mirroring the walk-in route. Not before every step above passes.

**Done when:** T3.1's "as a WhatsApp message" check and T2.4's "WhatsApp arrival" check both pass on a real phone, and the delivery rows show provider ids and statuses from the webhook.

---

## 4. The task-list entries to add to `docs/03-TASKS.md`

Insert after T3.5 and before "## Week 4":

```
### T3.6 Self-registration by event QR
- `/join/[token]`: public page opened from a QR printed per event; first name, surname, email, consent; creates or matches the contact, creates the attendee as a walk-in, checks them in through `check_in_attendee` (bidder number assigned), emails the pass, shows the pass link and bidder number on screen.
- `/events/[id]/join`: organiser page with the QR, the link, a print sheet, enable / disable / regenerate (audit-logged). Migration `0010` adds `events.join_token` and `events.join_nonce`.
- Consent source `self_registration`; token kind `j.` in `lib/auth/join.ts`; honeypot and per-IP rate limit on the action.
- **Done when:** the thirteen checks in `docs/07` §2.11 pass in the browser against the local stack.
```

Insert after T4.5:

```
### T4.6 WhatsApp (last)
- Verify every existing WhatsApp path against the Meta test number once the keys arrive: broadcast delivery and status webhook, pass by WhatsApp from the RSVP, outbid and winner templates. Optional phone + opt-in on `/join/[token]`.
- **Done when:** `docs/07` §3 passes on a real phone.
```

And in the Week 3 goal line and in T3.1's heading, leave the WhatsApp wording as it is; the ticks there already say "pending the Meta keys", which is now T4.6.

---

## 5. Order of work

1. Migration 0010, schema test block, `db reset`, `db:types:local`. Commit: `T3.6 Add join token columns for self-registration`.
2. `lib/auth/join.ts`, `signRaw` in `pass.ts`, `CONSENT_SOURCE.selfRegistration`, the two unit test files. Commit: `T3.6 Join token library and tests`.
3. `/join/[token]` page, form and action; `vercel.json` headers. Verify checks 3–10, 12 and 13. Commit: `T3.6 Public self-registration page and action`.
4. Console join page, controls, print sheet, action, desk row, feature flag, seed. Verify checks 2 and 11. Commit: `T3.6 Self-registration QR page, print sheet and seed`.
5. Docs: spec, tasks (tick T3.6 with evidence; add T4.6), demo script. Commit: `T3.6 Document self-registration and move WhatsApp to T4.6`.
6. Push after each commit. Then report to Moeketsi in the usual form: what is demo-able, what is blocked, what you need. Then start T4.1 from `docs/06`.
