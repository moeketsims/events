# CUT Events Platform — Comprehensive Plan

**Client:** Advancement Office, Central University of Technology, Free State (CUT)
**Scope:** A single platform for every university event, with invitations, RSVP, QR check-in, live broadcasts (in-app and WhatsApp), and digital silent auctions projected live.
**Status:** Planning — no code yet. Backend target: Supabase (project already provisioned).
**Approach:** Proof of concept first on free tiers, built on the production schema and architecture so it graduates to production by changing configuration and plan tiers, not code.
**Target pilot:** CUT Fundraising Gala Dinner, Friday 30 October 2026, 18:00, CUT Hotel School, Bloemfontein (listed on CUT's public events calendar). Six weeks from this plan; the POC demo lands in week 4, leaving a fortnight to decide whether the gala uses the platform for invitations and check-in.
**Date:** 20 September 2026

**Companion documents** (read in this order when building):
1. [docs/01-BUILD-SPEC.md](docs/01-BUILD-SPEC.md) — repo layout, schema, functions, RLS, routes, contracts, providers.
2. [docs/02-DESIGN-SYSTEM.md](docs/02-DESIGN-SYSTEM.md) — CUT brand facts, tokens, typography, logo rules, per-surface layouts, copy, asset inventory.
3. [docs/03-TASKS.md](docs/03-TASKS.md) — four weeks of tasks with acceptance criteria.
4. [docs/04-DEMO-SCRIPT.md](docs/04-DEMO-SCRIPT.md) — the 15-minute demo, kit, checklist, recovery moves.
5. [docs/05-HANDOFF-PROMPT.md](docs/05-HANDOFF-PROMPT.md) — the prompt that starts the implementing agent.
6. [CLAUDE.md](CLAUDE.md) — rules and conventions for the implementing agent.

---

## 1. What the Advancement Office asked for, and what it actually implies

The brief has four stated requirements. Each one pulls in unstated work that has to be planned for or the stated requirement fails on the night.

| # | Stated requirement | What it implies |
|---|---|---|
| 1 | Send invitations from the platform when there is an event | A contacts database (alumni, donors, staff, VIPs, partners), guest lists per event, invitation templates, multi-channel delivery (email, WhatsApp, SMS), RSVP capture (attending / declined / plus-ones / dietary needs), reminders, and POPIA-compliant consent tracking. |
| 2 | RSVPed attendees use a QR code for the attendance register | A unique, unforgeable pass per attendee, a scanner app for door staff that works on a phone, a fallback for people without a phone or with a dead battery, walk-in registration, and an exportable register that replaces the paper one. |
| 3 | After check-in, broadcast messages reach everyone attending, in-app and via WhatsApp | A "checked-in" audience segment, a real-time in-app feed, WhatsApp Business API integration with approved message templates, delivery tracking, and an opt-in captured at RSVP. |
| 4 | Digital auction, projected on screen, live updates, anonymous on screen but linked to real identities via the QR register | Lot catalogue, bidding rules (increments, reserve, soft close), real-time bid stream, a projection view, a bidder number assigned at check-in, a settlement flow so winners actually pay, and admin-only identity resolution. |

Cross-cutting implications: roles and permissions (the platform is for *every* event of the university, so multiple departments will use it), CUT branding, POPIA compliance, reporting for the Advancement Office, and resilience against poor venue connectivity and load-shedding.

---

## 2. Users and roles

| Role | Who | What they do |
|---|---|---|
| **Platform admin** | ICT / Advancement systems owner | Manages departments, users, global templates, integrations, branding. |
| **Event organiser** | Advancement staff, faculty event coordinators | Creates events, builds guest lists, sends invitations, monitors RSVPs, sends broadcasts, runs reports. |
| **Door staff (scanner)** | Ushers, student assistants | Scan QR codes, handle walk-ins, look up guests by name. Minimal UI. |
| **Auction operator** | Advancement staff / MC | Opens and closes lots, pauses bidding, resolves disputes, sees bidder identities. |
| **Projection display** | A laptop plugged into the venue projector | Read-only, full-screen, auto-updating auction board. No login beyond a display token. |
| **Attendee** | Invitee / guest | Receives invitation, RSVPs, gets QR pass, checks in, reads broadcasts, bids. Must never need to install an app. |
| **Finance / reconciliation** | Advancement finance officer | Sees auction results, payments, outstanding settlements, exports. |

Attendees authenticate with a **magic link or one-time code** sent to their email or WhatsApp number. No passwords. Staff use CUT email with Supabase Auth (email OTP now; Microsoft Entra SSO later if CUT ICT wants it).

---

## 3. End-to-end flows

### 3.1 Before the event

1. Organiser creates the event: name, date, venue, capacity, description, banner, RSVP deadline, whether plus-ones are allowed, whether an auction is attached.
2. Organiser builds the guest list from the contacts database (filter by segment: alumni year, donor tier, faculty, previous attendance) and/or imports a spreadsheet.
3. Organiser picks an invitation template and channel(s). The platform sends:
   - **Email** with a personalised RSVP link.
   - **WhatsApp** template message with an RSVP button (requires a pre-approved template).
   - **SMS** fallback for contacts with no email or WhatsApp.
4. Invitee opens the RSVP page (no login needed, the link carries a signed token): attending / not attending, plus-one details, dietary and accessibility needs, consent to WhatsApp updates.
5. On "attending", the platform issues a **pass**: a QR code shown on a mobile-friendly page, also sent by email and WhatsApp as an image. Optionally an Apple/Google Wallet pass later.
6. Automatic reminders go out at configurable intervals (e.g. 7 days, 1 day, morning of) to non-responders and to confirmed attendees.
7. Organiser watches the RSVP dashboard: invited, opened, accepted, declined, no response, capacity used.

### 3.2 At the door

1. Door staff open the scanner web app on any phone or tablet, log in, select the event.
2. They point the camera at the guest's QR code. The pass is verified server-side and the guest is marked **checked in** with a timestamp and the scanner's identity.
3. Duplicate scan shows "Already checked in at 18:42" rather than double-counting.
4. If the guest has no code: search by name or phone, check in manually. Walk-in: quick-add form (name, phone, email), consent tick, immediate pass.
5. If the event has an auction, check-in assigns the guest a **bidder number** (e.g. 042) and the pass page now shows it, together with the bidding link.
6. The attendance register is live: organiser sees the count and list in real time, exportable as CSV/PDF at any moment. The paper register is gone.

Offline tolerance: the scanner caches the event's guest list on load and queues check-ins if the venue connection drops, syncing when it returns. Scans verify against the cached signature so the door never stops.

### 3.3 During the event

**Broadcasts.** The organiser types a message, chooses audience (all checked-in, all RSVPed, VIP tag, table number), chooses channels (in-app feed, WhatsApp, SMS), previews, sends. Attendees see it on their pass page immediately via realtime push; WhatsApp copies go through the Business API. Delivery status per recipient is visible to the organiser. Typical uses: "Dinner is served in the Ballroom", "Auction for Lot 7 closes in 5 minutes", "Shuttle to the parking lot departs 22:00".

**Auction.** Attendees open the bidding page from their pass. They see the lot catalogue with images, descriptions, current bid, minimum next bid, and time remaining. They tap "Bid R2 500" (the platform proposes the next valid increment) or enter a higher amount. The bid is validated server-side (lot open, amount valid, bidder checked in) and appended to the bid ledger. Within a second the projection screen, every attendee's phone, and the operator console update.

On the projection screen, bids appear as **"Bidder 042 — R2 500"** or just the amount and a pulse animation, never a name. The operator's console shows the real name, table, and contact details behind each bidder number.

### 3.4 After the event

1. Lots close (automatically at scheduled time with soft-close extension, or manually by the operator).
2. Winners receive a WhatsApp and email with the lot, the winning amount, and a payment link (card, instant EFT) or instructions for EFT/collection.
3. Finance sees a settlement board: paid, pending, overdue. Reminders can be sent.
4. Organiser exports the attendance register, RSVP analytics, auction results, and a donor-ready summary. Attendance and giving history flow back to each contact's record for future segmentation.
5. Optional post-event thank-you broadcast and feedback survey link.

---

## 4. Functional modules

### 4.1 Contacts and consent (foundation for everything)
- Contact record: names, email, mobile, WhatsApp opt-in, organisation, title, tags/segments, alumni year, donor tier, relationship owner.
- Import from CSV/Excel with de-duplication by email and phone.
- Consent ledger: what the person agreed to, when, through which channel, and the wording shown. Required by POPIA and by Meta for WhatsApp.
- Unsubscribe / opt-out honoured across all events.

### 4.2 Events
- CRUD, status lifecycle (draft → published → live → closed → archived).
- Departments/owners so faculties can run their own events without seeing Advancement's donor data.
- Capacity and waitlist.
- Custom RSVP questions per event (dietary, accessibility, table preference, guest name).

### 4.3 Invitations and RSVP
- Templates with merge fields, CUT branding, and a preview.
- Channels: email (Resend or Postmark), WhatsApp (Meta Cloud API via a Business Solution Provider), SMS (Clickatell or BulkSMS, both South African).
- Scheduled sends and reminder rules.
- RSVP page reachable via signed link, no login.
- Tracking: sent, delivered, opened, responded, bounced.

### 4.4 Passes and QR check-in
- Pass = signed token (event id + attendee id + nonce, HMAC-signed). QR encodes a short URL carrying the token so the same code works for scanning and for opening the pass page.
- Scanner PWA using the device camera; works on iOS Safari and Android Chrome.
- Manual lookup, walk-in, and "check out" (optional, for events that need it).
- Live attendance dashboard and exports.
- Bidder number assignment on check-in for auction-enabled events.

### 4.5 Broadcasts
- Compose, target, preview, send, schedule.
- Audience segments computed live: checked-in, RSVPed-not-arrived, all invited, tag, table.
- In-app realtime feed on the pass page (Supabase Realtime), with browser notification permission prompt as an enhancement.
- WhatsApp: the platform must use **approved message templates** for anything outside a 24-hour customer-service window. The initial invitation/reminder/check-in confirmation opens the window; free-form broadcasts within 24 hours of the attendee's last message are allowed, otherwise a "utility" template such as "Update from {{event}}: {{message}}" is used.
- Delivery log per recipient per channel.

### 4.6 Auctions
- Auction attached to an event; multiple lots; lot images, description, donor of the item, starting bid, reserve (hidden), increment table (e.g. +R100 under R1 000, +R250 under R5 000, +R500 above).
- Lot states: upcoming, open, closing soon, closed, unsold, withdrawn.
- Bidding modes: silent auction (all lots open in parallel with a common close time) and live-sequenced (operator opens one lot at a time, MC drives the room). Support both, since a gala typically runs a silent auction through dinner and a few live lots after.
- Anti-sniping soft close: a bid in the last 2 minutes extends the lot by 2 minutes (configurable).
- Proxy bidding by the operator for someone without a phone.
- Outbid notification to the previous high bidder (in-app; WhatsApp optional).
- "Buy now" price and donation/pledge lots (fixed-amount giving, e.g. "Sponsor a student's textbooks R1 500" with unlimited takers).
- Projection view: full-screen, dark, high-contrast; grid of lots with current bid and bidder number; a ticker of recent bids; single-lot spotlight mode for live-sequenced lots; total raised counter. Refreshes via realtime, no manual reload.
- Operator console: open/close/pause/extend/withdraw lot, void a bid, see bidder identity, see live totals.
- Settlement: winner notification, payment link, status tracking, invoice PDF, collection note.

### 4.7 Payments
- Winners pay online via a South African gateway: **PayFast** or **Yoco** (card, instant EFT, SnapScan), or **Ozow** for instant EFT. Whichever CUT Finance already has a merchant agreement with should be preferred.
- Manual EFT and "pay at the cashier" also recorded.
- The platform records payments; it does not hold funds.
- Optional later: paid ticketing for events that charge admission.

### 4.8 Reporting
- Per event: invitation funnel, attendance rate, no-show list, check-in timeline, broadcast delivery, auction total, lot-by-lot results, settlement status.
- Cross-event: attendance history per contact, giving history, most engaged alumni, department usage.
- Exports to CSV/Excel; scheduled summary email to the organiser the morning after.

### 4.9 Administration
- Departments, users, roles.
- Branding (logo, colours) globally with per-event banner.
- Integration settings and credentials (WhatsApp, email, SMS, payment).
- Audit log for every sensitive action (identity lookup on a bidder, bid voided, contact exported).

---

## 5. Architecture

### 5.1 Stack

Every layer runs on a free tier for the proof of concept. The last column says what changes at production.

| Layer | Choice | Reason | POC (free) → Production |
|---|---|---|---|
| Database, auth, realtime, storage, edge functions, cron | **Supabase** (Postgres) | Already provisioned; Realtime channels give sub-second auction and broadcast updates without running a WebSocket server; Row Level Security enforces department and role isolation in the database itself. | Free: 500 MB database, 1 GB storage, 200 concurrent realtime connections, 500k edge function calls, project pauses after 7 idle days. → **Pro, about US$25/month**, needed for a real gala because 200 concurrent connections is fewer than one full ballroom. Can be downgraded between event seasons. |
| Web application | **Next.js** (React, TypeScript) on **Vercel** | One codebase serves the organiser console, attendee pass/bidding pages, scanner PWA, and projection view. Server routes handle webhooks. | Free Hobby plan for the POC. Hobby terms exclude commercial use, so production is either **Vercel Pro (about US$20/month)** or a move to **Cloudflare Pages via OpenNext, which is free for commercial use**. Decide at graduation; the code is the same. |
| Styling / UI | Tailwind CSS + shadcn/ui | Fast to build, accessible components, easy to brand. | No change. |
| QR generation | `qrcode` (server) | PNG for WhatsApp/email, SVG for the pass page. | No change. |
| QR scanning | `@zxing/browser` or `html5-qrcode` | Camera scanning in the browser, no app store. | No change. |
| Email | **Resend** | Simple API, delivery webhooks, good deliverability. | Free: 3 000 emails/month, 100/day, one custom domain. → Paid tier only if a single event needs more than 100 invitations in a day, or authenticate a CUT subdomain and stay free. |
| WhatsApp | **Meta WhatsApp Business Cloud API, called directly** (no BSP) | Direct integration has no middleman fee; Meta provides a free test number. | Free: test number sends to up to 5 verified recipient numbers, enough for a live demo. → Meta Business verification, a dedicated CUT number, template approval; utility replies inside the 24-hour window are free, templated messages cost a few cents each. |
| SMS | Clickatell or BulkSMS | South African routes. | **Skipped in the POC**, no free tier. Added at production as a fallback channel. |
| Payments | **Yoco** or **PayFast** | South African gateways, no monthly fee, webhook-driven confirmation. | Free sandbox in the POC. → Per-transaction fees only, on CUT Finance's merchant account. |
| Background jobs | Supabase Edge Functions triggered by `pg_cron` and database webhooks | Reminders, lot auto-close, delivery retries. | No change. |
| Monitoring | Sentry + Vercel analytics + Supabase logs | Errors on the night must be visible instantly. | Sentry developer tier is free. No change. |
| Source control and CI | GitHub, GitHub Actions | Migrations applied on push; a scheduled action pings Supabase so the free project never pauses before a demo. | Free. No change. |
| Domain | `*.vercel.app` | Zero setup. | → `events.cut.ac.za` via CUT ICT, needed for email deliverability and trust in invitations. |

Total POC cost: **R0**. Realistic production cost: **roughly US$25–45 per month** during event season, plus per-message WhatsApp and per-transaction payment fees. Cloudflare Pages instead of Vercel brings that down to the Supabase Pro fee alone.

### 5.2 Core data model

```
departments        id, name, slug
users              id (auth), department_id, role
contacts           id, department_id, first_name, last_name, email, phone_e164,
                   whatsapp_opt_in, tags[], alumni_year, donor_tier, notes
consents           id, contact_id, purpose, channel, wording_version, granted_at, revoked_at
events             id, department_id, title, starts_at, ends_at, venue, capacity,
                   rsvp_deadline, allow_plus_ones, status, branding jsonb, auction_enabled
event_questions    id, event_id, label, type, required, options jsonb
invitations        id, event_id, contact_id, token, sent_via[], sent_at, opened_at,
                   status (pending|accepted|declined|waitlisted|cancelled)
rsvps              id, invitation_id, attending bool, guest_count, answers jsonb, responded_at
attendees          id, event_id, contact_id, invitation_id (null for walk-ins), is_plus_one,
                   pass_token, bidder_number, checked_in_at, checked_in_by, checkout_at
message_deliveries id, kind (invite|reminder|broadcast|auction_notice), event_id,
                   contact_id, channel, provider_message_id, status, error, sent_at
broadcasts         id, event_id, author_id, body, audience jsonb, channels[], scheduled_at, sent_at
auctions           id, event_id, mode (silent|live), opens_at, closes_at, soft_close_seconds,
                   increment_table jsonb, terms_version
lots               id, auction_id, lot_number, title, description, images[], donor_name,
                   starting_bid, reserve, buy_now_price, status, closes_at, sort_order
bids               id, lot_id, attendee_id, amount, placed_at, is_proxy, placed_by_user_id,
                   voided_at, void_reason        -- append-only ledger
settlements        id, lot_id, attendee_id, amount, status (pending|paid|overdue|waived),
                   payment_provider, provider_ref, paid_at, invoice_url
audit_log          id, actor_id, action, entity, entity_id, metadata jsonb, at
```

Key rules enforced in the database:
- `bids` is append-only; the current high bid is a view over non-voided bids.
- A bid is accepted only if: lot status is `open`, the attendee's `checked_in_at` is not null, amount ≥ current high + increment, and `now() < closes_at`. This runs in a single Postgres function (`place_bid`) so two simultaneous bids can never both win.
- Bidder identity is exposed to attendees and the projection only as `bidder_number`. Row Level Security hides `contacts` and `attendees.contact_id` from anyone below auction operator.
- Department isolation: staff see only their department's events and contacts unless platform admin.

### 5.3 Realtime design
- One Supabase Realtime channel per event (`event:{id}`) carrying broadcasts and check-in counts.
- One channel per auction (`auction:{id}`) carrying bid events and lot state changes; the projection, attendee bidding pages, and operator console all subscribe.
- Clients render optimistically but trust only the server-confirmed event.
- Projection view reconnects automatically and shows a small "reconnecting" indicator rather than a stale board.

### 5.4 Security and POPIA
- Signed tokens for RSVP and passes; tokens are revocable and event-scoped.
- Row Level Security on every table; service-role key only in edge functions.
- Personal data minimised on public surfaces (bidder numbers, first-name-only in in-app feed if ever needed).
- Consent captured and versioned; opt-out honoured platform-wide.
- Data retention policy: attendee and bid data retained per Advancement policy; contact export requires admin role and is audit-logged.
- Information Officer at CUT to be consulted on the PAIA/POPIA manual entry for the platform.
- Auction terms and conditions shown and accepted before the first bid (Consumer Protection Act auction provisions apply even to charity auctions; confirm the wording with CUT Legal).

### 5.5 Resilience for the night
- **Connectivity:** venue Wi-Fi is unreliable; plan a dedicated LTE/5G router for the projection laptop and scanners. The scanner works offline; bidding requires connectivity and attendees will mostly use their own mobile data.
- **Load-shedding:** projection laptop on battery, router on a UPS or power bank, printed lot catalogue as backup, operator can record proxy bids and close lots manually.
- **Scale:** a large gala is 300–600 people; a sold-out hall is under 1 500. Supabase and Vercel handle this comfortably; the risk is burst bidding in the last minute of a lot, which the single-function bid path and soft close manage.
- **Dry run:** every auction event gets a rehearsal with the actual projector, router, and three phones two days before.

---

## 6. Delivery roadmap

### 6.1 Stage A — Proof of concept (weeks 1–4, cost R0)

The POC is a **thin vertical slice through all four requirements**, not a deep build of one. The Advancement Office should see the whole story in a 15-minute demo: invitation arrives, RSVP, QR pass, scan at the door, broadcast lands on phones and WhatsApp, auction bids move on the projector.

**Built for real, on the production schema:**
- Full database schema from Section 5.2, with migrations and Row Level Security from the first commit. The POC never uses a "temporary" schema.
- One department, two staff roles (organiser, door staff), attendee magic-link auth.
- Event creation, guest list from a CSV import, email invitation with RSVP page (Resend).
- Pass issuance with signed QR, scanner PWA with manual lookup and walk-in. Offline queue deferred.
- In-app realtime broadcast feed on the pass page. WhatsApp broadcast through the Meta test number to up to five demo phones.
- Auction with 4–6 lots, `place_bid` Postgres function, soft close, bidder numbers assigned at check-in, projection view, basic operator console with identity lookup.
- Attendance dashboard and auction results page, CSV export.

**Deliberately excluded, with the seam left in place:**
- SMS, payments (a sandbox "Pay now" button is enough), reminders, invoice PDFs, cross-event reporting, department switching UI, audit log UI (the table is written to, just not displayed).

**Demo kit:** a seed script that creates the "CUT Advancement Gala 2026" event with 40 fictitious guests, six lots with images, and staff logins; a one-page demo script; five volunteers' phones registered on the WhatsApp test number.

**Week by week:**

| Week | Focus | Demo-able at end of week |
|---|---|---|
| 1 | Repo, Supabase migrations, RLS, auth, Next.js shell, seed script, Vercel deploy. Submit Meta and payment applications. | Login, seeded event visible. |
| 2 | Contacts import, event editor, email invitations, RSVP page, pass with QR, scanner PWA. | Invite → RSVP → scan. |
| 3 | Realtime broadcast feed, WhatsApp test-number send, auction schema functions, bidding page. | Broadcast lands; bids accepted. |
| 4 | Projection view, operator console, soft close, results and exports, polish, rehearsal. | Full 15-minute demo. |

### 6.2 Stage B — Production graduation (weeks 5–16)

Same codebase. Each phase deepens a slice the POC already showed.

| Phase | Weeks | Delivers |
|---|---|---|
| **B0. Graduate the infrastructure** | 5 | Supabase Pro, Vercel Pro or Cloudflare Pages, `events.cut.ac.za`, SPF/DKIM for email, Sentry, on-call runbook. Real CUT branding. |
| **B1. Invitations and RSVP at scale** | 6–7 | Reminders, scheduled sends, delivery tracking, capacity and waitlist, custom RSVP questions, contact de-duplication, consent ledger UI, SMS channel. |
| **B2. Door hardening** | 8 | Offline scanner queue and sync, duplicate handling, check-out, printed bidder cards, live register for the organiser. |
| **B3. WhatsApp production** | 9–10 | Verified Meta Business account, CUT number, approved templates for invite, reminder, check-in confirmation, broadcast, outbid notice, winner notice. Delivery log. |
| **B4. Auction completeness** | 11–12 | Live-sequenced mode, proxy bidding, buy-now and pledge lots, void bid, lot withdrawal, terms acceptance, outbid notifications, projection spotlight and total-raised modes. |
| **B5. Settlement, payments, reporting** | 13–14 | Live payment gateway, settlement board, invoices, winner reminders, per-event and cross-event reports, attendance and giving history on contacts. |
| **B6. Multi-department, hardening, handover** | 15–16 | Department admin UI, audit log UI, load test of burst bidding, POPIA review with the Information Officer, training, documentation. |

Roughly four months end to end for one full-stack developer with a product owner from Advancement. The POC is ready to show in a month; a first real event with invitations and QR check-in can run from week 8.

### 6.3 What "moves immediately to production" depends on

The POC will graduate cleanly only if these disciplines hold from day one:
- **Migrations, not dashboard edits.** Every schema change is a versioned SQL migration in the repo, applied by CI.
- **RLS on from the first table.** Retrofitting row-level security is the single most common reason a POC has to be rebuilt.
- **Config in environment variables.** Provider keys, sender addresses, WhatsApp number, payment mode. Production is a different `.env`, not different code.
- **Two Supabase projects.** The free tier allows two: `cut-events-dev` for the POC and daily work, `cut-events-prod` created empty at graduation and populated by the same migrations. Never demo from the project that will hold real donor data.
- **Real providers in sandbox mode, not mocks.** Resend, Meta, and Yoco are all called for real in the POC, just against test recipients and test merchants.
- **Seed data is clearly fictitious.** No real alumni or donor records enter the system before the POPIA review.

Items with **external lead times** to start in week 1:
- Meta Business verification and WhatsApp Business API access (2–6 weeks).
- WhatsApp message template approvals (days each, iterative).
- Payment gateway merchant onboarding with CUT Finance (2–4 weeks).
- Sending domain authentication (SPF/DKIM) with CUT ICT for email deliverability.

---

## 7. Screen inventory

**Organiser console (desktop-first)**
Dashboard · Contacts list and import · Contact detail · Events list · Event editor · Guest list builder · Invitation composer and preview · RSVP dashboard · Attendance dashboard · Broadcast composer and log · Auction editor and lot editor · Operator console · Settlement board · Reports · Settings (department, users, branding, integrations) · Audit log.

**Attendee (mobile-first, no install)**
Invitation/RSVP page · Pass page (QR, event info, bidder number, live feed) · Auction catalogue · Lot detail with bid button · My bids · Winner/payment page.

**Door staff (mobile PWA)**
Login · Event picker · Scanner · Result card (success / duplicate / invalid) · Name search · Walk-in form · Counter.

**Projection (full-screen)**
Lot grid · Lot spotlight · Recent bids ticker · Total raised · Sponsor/branding interstitial.

---

## 8. Non-functional requirements

- Bid to projection latency under 1 second on a normal connection.
- Check-in scan to confirmation under 2 seconds online; instant offline with later sync.
- Attendee pages work on a low-end Android phone on mobile data; first load under 1 MB.
- Accessibility: WCAG 2.1 AA for attendee-facing pages; projection legible from 20 metres.
- Availability target on event days: 99.9%, with named on-call developer during pilot events.
- All timestamps stored UTC, displayed in South Africa Standard Time.
- Currency ZAR throughout, formatted "R2 500".

---

## 9. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| WhatsApp API approval delayed or templates rejected | Broadcasts limited to in-app, email, SMS | Start application in week 1; design so WhatsApp is an additional channel, never the only one. |
| Poor venue connectivity | Bidding stalls | Dedicated LTE router, offline scanner, proxy bidding, rehearsal. |
| Load-shedding during the gala | Projection dark | Laptop battery, UPS for router, printed lot list, manual close. |
| Guests unfamiliar with phone bidding | Low participation | Bidder number on a printed card at check-in, ushers with tablets to bid on behalf of guests, clear projection instructions. |
| Winners not paying | Lost revenue | Immediate payment link at close, payment desk at the exit, settlement board with reminders. |
| Personal data exposure | Reputational and legal | RLS, bidder numbers only on public surfaces, audit logging, POPIA review. |
| Departments misusing donor contacts | Trust with donors | Department isolation of contacts; sharing is explicit and logged. |
| Scope creep from "every event of the university" | Delivery slips | Phase gates; the POC slice is fixed at Section 6.1 and additions go to Stage B. |
| Supabase free project pauses after 7 idle days | Demo fails to load | Weekly GitHub Actions ping; restore manually the morning of any demo (takes about a minute). |
| Free-tier limits hit at a real event | Bids or check-ins rejected | Graduate to Supabase Pro before the first real event (B0); 200 concurrent realtime connections is the binding limit. |
| Vercel Hobby terms and university use | Account suspended | Treat Hobby as POC-only; move to Vercel Pro or Cloudflare Pages at B0. |

---

## 10. Open questions for the Advancement Office

1. Do they have an existing donor/alumni CRM (e.g. Raiser's Edge, Salesforce, a spreadsheet)? Integration versus import changes Phase 1.
2. Does CUT already have a verified Meta Business account or a WhatsApp Business number? Which BSP, if any?
3. Which payment gateway does CUT Finance already use, and can auction proceeds be received into an existing merchant account?
4. Typical and maximum event sizes, and how many events per year across departments?
5. Should remote (non-attending) bidders ever be allowed, or is bidding strictly for checked-in guests as the brief implies?
6. Are there paid-ticket events in scope, or are all events by invitation only?
7. Who is CUT's Information Officer for the POPIA review, and is there an existing privacy notice to align with?
8. Which is the first pilot event, and when? This sets the real deadline for Phases 1–2 or 1–4.

---

## 11. Immediate next steps

1. Initialise the repository: Next.js app, Supabase migrations for the Section 5.2 schema, RLS policies, seed script, Vercel deploy. This is week 1 of the POC.
2. Create free accounts: Resend, Meta for Developers (WhatsApp test number), Yoco or PayFast sandbox, Sentry, GitHub.
3. Build the Stage A slice week by week per Section 6.1 and rehearse the 15-minute demo.
4. Present the POC to the Advancement Office with the open questions from Section 10 and the production cost line from Section 5.1.
5. On approval, run B0 and start the external applications (Meta Business verification, payment merchant onboarding, `events.cut.ac.za`).
