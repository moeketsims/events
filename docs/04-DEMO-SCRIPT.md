# 04 — Demo Script and Pre-Demo Checklist

Audience: Institutional Advancement (Director, Administrator, events staff). Duration: 15 minutes plus questions. Story: the CUT Fundraising Gala Dinner, 30 October 2026, run on the platform from invitation to auction settlement.

## Kit

| Item | Purpose |
|---|---|
| Laptop A (presenter) | Organiser console in one browser window; projection view in a second window on the external display |
| External display or projector | `/display/{auctionId}?k=…` fullscreen |
| Phone 1 (presenter) | Door scanner, logged in as `door@…` |
| Phones 2–5 (volunteers or Advancement staff) | Attendees: each has a pass URL open and has sent "Hi" to the WhatsApp test number within the last 24 hours |
| LTE hotspot | Independent of venue Wi-Fi |
| Printed A6 card | Shows one pass QR, for the "guest without a phone" moment |

## Pre-demo checklist (T-60 minutes)

- [ ] `pnpm seed` run against the dev project; magic link, two pass URLs, display URL copied.
- [ ] Supabase project is awake (open the dashboard; if paused, restore and wait 2 minutes).
- [ ] Vercel deployment is the latest `main`; `/login` loads.
- [ ] Phones 2–5: pass URLs open, "Hi" sent to the WhatsApp test number, numbers present in Meta test recipients.
- [ ] Phone 1: `/scan` logged in, camera permission granted, event selected.
- [ ] Display window fullscreen on the external screen in grid mode; laptop set to not sleep.
- [ ] Two lots set to close 6 and 9 minutes after the planned auction segment start (edit `closes_at` in the lot editor).
- [ ] Resend and Meta smoke messages sent successfully this morning.
- [ ] Hotspot on, laptop and phones connected to it, not to venue Wi-Fi.

## Script

**0:00 — Frame (1 min).**
"This is a working system, not slides. Everything you see is live on phones in this room. It is built on the schema and architecture we would take to production, on free hosting for now."

**1:00 — Invitation and RSVP (3 min).**
Laptop: open the Gala event overview, show the funnel tiles (40 invited, 28 accepted, 6 declined, 6 pending). Open the guest list, pick one pending contact, open Invitations, send email + WhatsApp to that one person. Phone 2 (acting as that person) receives the WhatsApp within seconds; open the RSVP link, accept, tick the WhatsApp consent, submit. Show the pass appear on Phone 2 and the funnel tile tick up on the laptop.

Say: "Guests never install anything. The link is the pass."

**4:00 — Door (2 min).**
Phone 1 scans Phone 2's QR. Green card: "Welcome, Naledi." Show the attendance dashboard on the laptop updating without a refresh. Scan Phone 2 again: "Already checked in at 14:07". Scan the printed A6 card: checked in. Phone 2 (now acting as a guest with no invitation) scans the table QR from the printed sheet, types a first name, surname and an `@example.com` address, ticks the consent and submits: "You are checked in" with a bidder number, and the register on the laptop ticks up again. If the guest's camera fails, the usher's Walk-in tab does the same in 20 seconds.

Say: "No paper register. The list is live, exportable, and every check-in is time-stamped and attributed to the usher who scanned it."

**6:00 — Broadcast (2 min).**
Laptop: Broadcasts → "Welcome to the Gala. The silent auction is open; bidding closes at 21:30. Tap Auction on your pass." Audience: checked in. Channels: in-app + WhatsApp. Send. Phones 2–5 show it on the pass page and as a WhatsApp message. Point out the delivery log.

Say: "Only people who have actually arrived receive it. Someone who RSVPed but is stuck in traffic does not get 'dinner is served'."

**8:00 — Auction (5 min).**
Switch attention to the projector in grid mode. Phones 2–5 open Auction from their passes. Ask two volunteers to bid on Lot 2 (the jersey). The board flashes gold and shows "Bidder 014 — R1 750". Ask a third to bid; the earlier bidder's phone shows "Outbid". Try a bid below the minimum on one phone; show the rejection copy. Switch the display to spotlight on Lot 1 from the console. Let the 6-minute lot approach close; place a bid inside the last two minutes and show the countdown extend.

Console: click "Reveal bidder" on the leading bid to show the name behind the number, and mention the audit log.

Say: "The room sees numbers, never names. The Advancement team sees exactly who is bidding, because the number was assigned at the door from the QR check-in."

**13:00 — Close and settle (2 min).**
Let the lot close (or click Close now). Results page: winner, amount, reserve met. Click "Send winner notices". Winner's phone receives the WhatsApp with a Pay now link; open it, pay with a Yoco test card; results page shows Paid.

Say: "Nobody chases anyone for money after the event. The link arrives the moment the lot closes."

**15:00 — What production adds (1 min).**
Reminders and scheduled sends, SMS fallback, the CUT WhatsApp number with approved templates, offline scanning, live-sequenced auction mode for the MC, invoices and Section 18A letters, reports across events, `events.cut.ac.za`. Hosting cost line from PLAN.md §5.1. Then the open questions from PLAN.md §10.

## Recovery moves

| If | Then |
|---|---|
| WhatsApp message does not arrive | Continue with in-app feed and email; say the test number is limited to five pre-registered phones and the 24-hour window, both lifted with the production number. |
| Camera will not open on Phone 1 | Use the Search tab to check the guest in by name; mention that this is also the path for a dead battery. |
| Projector shows "Reconnecting" | Wait; the board resumes. Meanwhile show the same board on the laptop window. |
| Supabase paused | Restore from the dashboard; talk through slides of the console for two minutes. |
| A lot closed early | Console → Extend 2 min or Open. |

## After the demo

- Capture answers to the PLAN.md §10 questions.
- Confirm the pilot: is 30 October 2026 realistic for invitations and QR check-in only, with the auction on the platform or on paper? Record the decision in PLAN.md.
- Reset the dev project with `pnpm seed`.
