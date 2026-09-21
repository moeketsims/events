# 08 — Walkthrough recording: plan, prep and narration

A narrated screen recording of the working platform, running on the deployed
site at **https://cut-events.vercel.app**, for Institutional Advancement.

It is **not** `docs/04-DEMO-SCRIPT.md`. That one is the live fifteen-minute
demo on the night, with a projector, five phones and every provider connected.
This is a nine-minute recording of what is finished and honest today, following
one thread: **a member of staff signs in, sets an event up, and guests arrive
and check themselves in with a printed QR code.**

Everything below was verified on the deployed site on 21 September 2026.

---

## 1. The spine

Three acts, in the order a real event happens.

| Act | What the viewer sees | Minutes |
|---|---|---|
| **1. Set it up** | Sign in, create an event from nothing, publish it, build the guest list | 0:00–3:30 |
| **2. The room fills** | Print the table code, a guest scans it and is checked in as Bidder 001, the register moves live | 3:30–6:00 |
| **3. The night runs** | An invited guest is scanned at the door, bids from their pass, the board moves | 6:00–8:30 |
| **Close** | Consent, anonymity, nothing to install | 8:30–9:00 |

Act 1 and Act 2 happen on a **brand-new event you create on camera**. Act 3
switches to the seeded Gala, because only it has invited guests with passes, an
auction and bids. Narrate the switch plainly: "here is one already under way."

The payoff of Act 2 is that the first person through the door of a brand-new
event gets **Bidder 001**. Bidder numbers come from the event's auction flag
alone, so tick *This event has a silent auction* on the create form and that
moment works without setting up a single lot.

---

## 2. What is real, and what you must not claim

Say the second list out loud once, early, in one sentence. It buys credibility
for everything else, and it stops a viewer discovering it themselves.

**Real and working on the deployed site**

- Staff sign-in, roles, and a console scoped to one department by the database.
- Creating and publishing an event; guest list; invitation composer and preview.
- Self-registration by printed QR: register, consent, check in, bidder number, pass.
- The attendance register updating live, with no reload.
- The scanner, using a real phone camera, including the duplicate-scan message.
- The pass: QR, bidder number, the organiser's message feed.
- Bidding from a phone, with the minimum enforced by the database.
- The projection board: six lots, amounts, bidder numbers, running total, ticker.
- Every consent stored with its wording version, and an audit trail.

**Absent today — do not stage around it, just say it**

- **No email and no WhatsApp.** Invitations and pass copies are composed but not
  delivered; the providers are not connected on this demo project. Show the
  composer and the preview, then say so.
- **No operator console** (T4.2). The projection cannot be switched between
  grid, spotlight and total from a screen yet. Leave it in grid.
- **No results or payment** (T4.3). There is no winners screen and no checkout.
- **Countdowns do not tick.** The seeded lots close on 30 October 2026, so the
  board reads "Closes 21:30". Ask Claude to move a lot's closing time to a few
  minutes out if you want a live countdown on camera.

---

## 3. Devices and capture

| Device | Role | What is open |
|---|---|---|
| **Laptop** | The console, and the projection on a second screen or second window | Signed in as the organiser |
| **Phone 1** | The usher | `https://cut-events.vercel.app/scan` |
| **Phone 2** | The guest | Nothing; it scans its way in |

Two moments need a **real camera** and cannot be faked in a browser window: the
guest scanning the printed table sheet, and the usher scanning a pass. Phone 2's
scan can be replaced by typing the join URL, but the usher's cannot.

For capturing Phone 1 and Phone 2 on screen, easiest first:

1. **Android mirroring** — `scrcpy`, or Windows Phone Link. Gives a clean window
   you can place beside the console. Best result.
2. **A second camera** pointed at the phone in a stand. Honest and simple, and
   it shows a hand holding a phone, which suits this story.
3. **iPhone** — QuickTime screen recording over cable on a Mac, or AirPlay to the
   laptop.

Set the laptop to 1920×1080, hide the bookmarks bar, silence notifications, and
close every other tab. The console is capped at 1200 px, so a full-screen
browser at 1080p frames it well.

---

## 4. Prepare, in this order

**The day before**

1. Decide the capture method above and test it once, recording thirty seconds.
2. Print the table sheet on actual A4. It is the prop the whole of Act 2 turns
   on, and a printed sheet on a table reads far better than a QR on a screen.

**Within the hour before**

3. **Reset the demo data** so the figures are clean:

   ```bash
   bash scripts/reseed-hosted.sh
   ```

   This rebuilds the Gala, and **re-attaches Qondakele's account**, which the
   seed would otherwise detach — the teardown nulls the department on every
   profile it finds, including real staff. The script handles it; do not run
   `pnpm seed` against the hosted project by hand.

4. **Note the fresh links.** Every pass token changes on a reseed. From the seed
   output keep: the two checked-in passes, the one *not yet through the door*
   (that is the one Phone 1 scans), and the projection URL.

5. **Sign in on the laptop and leave the tab open:**

   ```bash
   pnpm tsx scripts/staff-link.mts organiser@demo.cut-events.test
   ```

6. Open the projection on the second screen and press F11.

---

## 5. The script

Narration is a suggestion, not a read. Keep sentences short; let the screen do
the work; never narrate a click you are about to make.

### Act 1 — Set it up (0:00–3:30)

**Sign in.** Open `/login`. Type `organiser@demo.cut-events.test`. Do not submit.

> "Staff sign in with a six-digit code by email. There are no passwords to
> forget and no accounts to manage."

Cut to the dashboard tab you signed in to earlier.

> "This is the evening at a glance. One event live, twelve guests in the room,
> twenty thousand two hundred and fifty rand on the board."

Rest on the dashboard for a beat. Do not read the figures out; they are on screen.

**Create the event.** Desk → *Create an event*, or `/events/new`.

Fill it in while talking:

| Field | Value |
|---|---|
| Title | `CUT Alumni Homecoming` |
| Starts | a date two or three weeks out, 18:00 |
| Venue | `CUT Bloemfontein Campus` |
| Capacity | `120` |
| Plus-ones | on |
| Silent auction | **on** |

> "Everything else — the banner, the questions, the lots — comes after it
> exists. This is the minimum to open the doors."

Create it. It lands as a **draft**.

> "A draft is invisible. Nobody can RSVP and no code works until an organiser
> publishes it."

Publish it. Point at the status pill changing.

**The guest list.** Open *Guest list*, filter, add a handful of contacts.

> "Contacts belong to the department, not to the event. The same donor carries
> their history from one event to the next."

Open *Invitations*, compose, and show the **preview**.

> "That is what would go out by email and WhatsApp. The providers are not
> connected on this demo project yet, so nothing is actually sent today."

Move on immediately. Do not dwell.

### Act 2 — The room fills (3:30–6:00)

This is the centre of the recording. Slow down here.

**The table code.** Event overview → *Self-registration QR* → **Turn on
self-registration**.

> "One code per event. It goes on every table and at the door."

Open **Print sheet**. Let the A4 sheet fill the screen.

> "The code is a hundred and twenty millimetres, readable across a table. The
> address is printed underneath for anyone whose camera will not focus."

Now pick up the **printed sheet** and Phone 2.

**Phone 2 scans the sheet.** The camera app opens the page — no app, no store.

> "No application to install. Their own camera is the whole of it."

Fill the form on camera: first name, surname, email, tick the consent.

> "Three things and a tick. The wording is stored with the version, because
> under POPIA the university has to be able to say what this person agreed to."

Submit. Hold on the result.

> "Checked in, and Bidder 001. Registering at the table *is* the check-in —
> scanning a code that only exists inside the venue is the proof of arrival."

**Cut to the laptop, attendance register.** The arrival is already at the top:
their name, *Walk-in*, the bidder number, the time. The counts have moved.

> "Nobody refreshed anything."

**Back to Phone 2.** *Open your pass* — the QR, the name, the bidder badge.

### Act 3 — The night runs (6:00–8:30)

> "Now the Gala, already under way, with guests who replied weeks ago."

Switch the laptop to the seeded Gala event.

**The door.** Phone 1: `/scan` → choose the Gala → allow the camera.

Phone 2 opens the pass of the guest who has **not yet arrived** (from the seed
output). Phone 1 scans it.

> "Welcome, Annelie."

Scan the same pass again.

> "Already checked in, with the time. Every scan is stamped and attributed to
> the usher who made it. There is no paper register to reconcile afterwards."

**Bidding.** On Phone 2, *Open the auction*, choose a lot, place a bid. Show the
terms appearing on the first bid only.

> "The terms are accepted once, on the first bid, and stored."

**The projection.** Cut to the second screen as the bid lands: the amount moves,
the card flashes gold, the chip joins the ticker, the total climbs.

> "Under a second, and nowhere on that screen is anybody's name. The room sees
> bidder numbers. Only the organiser can look behind one, and doing so is
> written to the audit log."

### Close (8:30–9:00)

Land on the projection or the dashboard.

> "No application, no accounts for guests, no paper. A link is the invitation, a
> code on the table is the door, and the phone in their pocket is the bidding
> paddle. Built on the university's own brand, and every piece of personal
> information consented to and recorded."

---

## 6. If something goes wrong

| Problem | Move |
|---|---|
| Camera will not open on the scanner | Use *Search* in the scanner and check the guest in by name. Same result, one beat lost. |
| The join page 404s | The code was regenerated or the event is not published. Check the event is live, then reopen the join page from the console. |
| A bid is refused | Read the reason aloud — it is the product working. "Too low" shows the minimum. |
| The register does not move | Reload once. The page is server-rendered, so a reload is always correct. |
| Sign-in link is spent | Mint another with `scripts/staff-link.mts`. They are one-time by design. |

Record the three acts as **three separate takes**. Editing them together is
easier than getting nine unbroken minutes, and a fluffed line costs you thirty
seconds instead of the whole recording.

---

## 7. After

- Keep the raw takes. The same footage cut to three minutes makes the opener for
  the Institutional Advancement presentation.
- Note anything that surprised you into `docs/04-DEMO-SCRIPT.md`; the rehearsal
  at T4.5 inherits it.
- The two things that would most improve the next recording are the operator
  console (T4.2), which puts mode switching on screen, and a Resend key, which
  makes the invitation actually arrive.
