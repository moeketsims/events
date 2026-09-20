# 02 — Design System and Brand

Everything the interface needs to look like it belongs to Central University of Technology, Free State. Brand facts come from CUT's official Corporate Identity page (https://www.cut.ac.za/ci) and the public website's stylesheet; everything else is a decision made here for this product.

---

## 1. Institution facts used in the product

| Fact | Value | Where it appears |
|---|---|---|
| Full name | Central University of Technology, Free State | Email footers, RSVP page, T&Cs |
| Short name | CUT | Everywhere else |
| Motto | **Thinking Beyond** | Projection idle screen, email footer |
| Campuses | Bloemfontein (main) · Welkom | Venue picker defaults, footer contact lines |
| Switchboards | Bloemfontein +27 51 507 3911 · Welkom +27 57 910 3500 | Footer |
| Website | https://www.cut.ac.za | Footer |
| Client unit | **Institutional Advancement** — pillars: Fundraising, Development, Alumni Relations, Stewardship | Default department name; "Donate to CUT" language |
| Giving categories | Sport · Applied Research · Estates and Infrastructure · CUT Annual Fund | Pledge-lot categories, results report grouping |
| Tax status | Public benefit organisation; bona fide donations are tax-deductible (Section 18A) | Winner receipt and pledge confirmation copy: "CUT is a public benefit organisation; a Section 18A certificate can be issued on request." |
| Target pilot event | **CUT Fundraising Gala Dinner**, Friday 30 October 2026, 18:00, CUT Hotel School | Seed data mirrors this event |
| Unit leadership (public on the CUT site) | Director: Qondakele Sompondo · Administrator: Abongile Khahla | Stakeholders for the demo; not shown in the product |

---

## 2. Colour

### 2.1 Official palette

| Name | Pantone | Hex | Official role |
|---|---|---|---|
| **CUT Blue** | 295C | `#003261` | Primary. The only brand colour for layouts. |
| White | — | `#FFFFFF` | Secondary. |
| Logo maroon | — | `#881010` (sampled from the supplied PNG) | **Logo only.** The shield in the CUT symbol. Never used as a UI colour. |
| Logo gold | — | `#F8B000` (sampled) | **Logo only.** The arc in the CUT symbol. The product's `gold-500` accent (`#FBB927`, Pantone 1234) is deliberately close so accents harmonise with the logo without copying it. |
| Faculty: Engineering, Built Environment and IT | Process Blue | `#0082D1` | Accent, ≤ 30 % of a design |
| Faculty: Health and Environmental Sciences | 362 | `#289728` | Accent, ≤ 30 % |
| Faculty: Humanities | 1234 | `#FBB927` | Accent, ≤ 30 % |
| Faculty: Management Sciences | 1807 | `#A12830` | Accent, ≤ 30 % |

The CUT website additionally uses `#004B88` as its working blue and `#001738` as a deep navy. Both are used here as tonal steps of CUT Blue.

### 2.2 Product tokens

Defined once in `app/globals.css` under `@theme`, mirrored into shadcn's CSS variables. Light theme for staff and attendee surfaces; the projection uses the dark set.

```css
@theme {
  /* brand */
  --color-cut-950: #001738;   /* projection background, deepest navy */
  --color-cut-900: #003261;   /* CUT Blue, primary */
  --color-cut-800: #004072;
  --color-cut-700: #004B88;   /* hover, links */
  --color-cut-600: #255C91;
  --color-cut-100: #E6EEF6;   /* tinted surfaces */
  --color-cut-50:  #F3F7FB;

  /* accents (use sparingly; the 30 % rule) */
  --color-gold-500: #FBB927;  /* leading bid, live indicator, primary CTA on dark */
  --color-gold-600: #E0A31E;
  --color-sky-500:  #0082D1;  /* informational */
  --color-green-600: #289728; /* success, checked in */
  --color-red-700:  #A12830;  /* error, destructive, outbid */

  /* neutrals */
  --color-ink-900: #111827;
  --color-ink-700: #374151;
  --color-ink-500: #6B7280;
  --color-ink-300: #D1D5DB;
  --color-ink-100: #F3F4F6;
  --color-paper:   #FFFFFF;
}
```

shadcn mapping (light): `--background: paper`, `--foreground: ink-900`, `--primary: cut-900`, `--primary-foreground: paper`, `--secondary: cut-100`, `--accent: gold-500`, `--destructive: red-700`, `--muted: ink-100`, `--border: ink-300`, `--ring: cut-700`.

Projection (dark): `--background: cut-950`, `--foreground: paper`, `--primary: gold-500`, `--card: cut-900`, `--border: cut-700`, `--muted-foreground: #A8C0DA`.

### 2.3 Semantic use

| Meaning | Token | Example |
|---|---|---|
| Brand, primary action | `cut-900` | Buttons, header bar, QR frame |
| Leading / winning | `gold-500` on `cut-900` or `cut-950` | "You are leading", top bid on projection |
| Success | `green-600` | Check-in success card, "Paid" |
| Warning / closing soon | `gold-600` text on `gold-500/10` background | Countdown under 2 minutes |
| Error / outbid / destructive | `red-700` | Invalid QR, "Outbid", void bid |
| Informational | `sky-500` | Tips, pending states |

Per-event accent: `events.branding.accent` may pick one of the four faculty colours for a faculty-hosted event. It replaces `gold-500` in badges and the projection ticker only. Advancement events use gold.

Contrast: `cut-900` on white is 12.6:1; `gold-500` on `cut-950` is 9.3:1; white on `cut-700` is 7.4:1. Do not put `gold-500` text on white.

---

## 3. Typography

CUT's spacing guide (`public/brand/spacing-guide.pdf`) states that the identity system uses **Univers Condensed**, and that the logotype itself is a custom alphabet that must never be re-set in another face. CUT's website body text is **Myriad Pro**. Both are licensed typefaces that cannot be embedded for free, so the product uses two open substitutes loaded through `next/font/google` with `display: swap`:

- **Barlow Condensed** (weights 500, 600, 700) for display and headings, standing in for Univers Condensed.
- **Source Sans 3** (weights 300, 400, 600, 700) for everything else, Adobe's open humanist sans with Myriad's proportions.

| Role | Face | Size / line | Weight |
|---|---|---|---|
| Display (projection amount) | Barlow Condensed | 160 px / 1.0, `font-variant-numeric: tabular-nums` | 700 |
| Display (projection lot title) | Barlow Condensed | 64 px / 1.1 | 600 |
| H1 | Barlow Condensed | 36 px / 1.15 | 700 |
| H2 | Barlow Condensed | 28 px / 1.2 | 600 |
| H3 | Source Sans 3 | 18 px / 1.3 | 600 |
| Body | Source Sans 3 | 16 px / 1.5 | 400 |
| Small / meta | Source Sans 3 | 14 px / 1.4 | 400 |
| Amounts anywhere | Source Sans 3 | inherit, `tabular-nums` | 600 |
| Mono (tokens, bidder numbers on cards) | `ui-monospace` | 14 px | 500 |

Letter-spacing on uppercase labels: `0.06em`. Never justify. Maximum measure for body text 68 ch.

---

## 4. Logo

Rules from the CI page and the spacing guide PDF (fetched to `public/brand/spacing-guide.pdf`):

- The symbol and the university name are an **inseparable unit**; never use the symbol alone; never display the logotype by itself; never re-set the logotype in another typeface.
- **Isolation area:** a clear margin of at least `x` on all sides, where `x` is the height of the logotype characters. In practice, on screen, keep a margin equal to the height of one line of the "Central University of" text.
- **Minimum size:** 35 mm wide for the horizontal configuration, 25 mm wide for the vertical. On screen, treat this as 132 px and 96 px at 96 dpi; use 160 px and 120 px as working minimums.
- **Non-white backgrounds:** "a white area such as a white block or band must be created for the CUT identity to live on." This is the white plate rule used throughout the product.
- The supplied PNGs are RGB on white with no transparency, which is why the plate is the only correct way to place them on colour.
- **Favicon precedent:** CUT's own website uses a symbol-only favicon and apple-touch-icon (fetched to `public/brand/favicon-src/`). The product follows that precedent for the 16 px and 32 px favicons only; every icon 180 px and larger carries the full logo on a white plate.

Files are fetched into `public/brand/` by `scripts/fetch-brand-assets.ps1` (Windows) or `.sh`:

| Local file | Source (cms.cut.ac.za/Files/Froala/…) | Use |
|---|---|---|
| `logo-h-lg.png` | `3a4c840c-32a2-4565-8b82-7f508aa70212.png` | Header, emails |
| `logo-h-md.png` | `5941062b-f35c-4019-a5ea-5ae1789c828c.png` | Pass page |
| `logo-h-sm.png` | `1a7a4583-9f6f-4192-afcf-f5245c7004f9.png` | Favicons base, footers |
| `logo-v-lg.png` | `d2637e85-ab3a-462b-a906-ba3bdc5e660a.png` | Projection idle screen |
| `logo-v-md.png` | `29c1c39b-742d-416c-b9d9-ddc807d0e137.png` | RSVP hero |
| `logo-hires.pdf` | `b7c75287-7990-4eca-b301-f0c1e431f236.pdf` | Print (bidder cards) |
| `watermark.png` | `79a42300-c021-4a2a-8f45-2551a8cccff9.png` | Projection background at 6 % opacity |
| `spacing-guide.pdf` | `d8a64477-0af9-49f5-93b1-d15ff49102d7.pdf` | Reference |
| `logo-20yrs-h-lg.png` | `c360a262-0988-4f3e-bd1e-05ef3b8cebfe.png` | Optional, if Advancement wants the anniversary mark |

The fetch script writes a `SOURCES.md` next to the files with the URL and fetch date of each. The files are CUT's property; the repository README states they are used with the institution's brand rules for an internal CUT system.

Placement: on white backgrounds use the logo as supplied. On `cut-900`/`cut-950` backgrounds place the logo on a white rounded plate with 16 px padding (the CI page supplies no reversed version). Minimum width 120 px on screen. Nothing else within one symbol-height of the logo.

`components/brand/Logo.tsx` exposes `<Logo variant="horizontal|vertical" size="sm|md|lg" plate />`.

---

## 5. Layout and components by surface

### 5.1 Staff console (desktop first, works to 768 px)

- Left sidebar 240 px, `cut-900` background, white text, logo plate at top, nav items with lucide icons. Collapses to a top bar below 1024 px.
- Content area max 1280 px, 24 px gutters, white cards with 1 px `ink-300` border and 8 px radius. No drop shadows except on popovers.
- Page header: H1 left, primary action button right, breadcrumb above.
- Tables: shadcn `DataTable` with sticky header, row height 44 px, right-aligned numbers.
- Funnel numbers on the event overview as stat tiles: label small caps, value 32 px tabular.
- Status pills: `draft` ink, `published` sky, `live` gold with pulsing dot, `closed` green, `archived` ink-500.

### 5.2 Attendee pages (mobile first, 360 px baseline)

- Single column, 16 px gutters, max 480 px centred on desktop.
- Top band `cut-900` with logo plate and event title; content on white below.
- Pass card: white card, QR 240 px square with 12 px quiet zone, `cut-900` 4 px frame; attendee name 24 px; event line; bidder number appears as a gold badge "Bidder 042" after check-in.
- Feed: newest first, each message a card with time in `ink-500`, unread messages get a 3 px gold left border until viewed.
- Lot card: 4:3 image, title, current bid 24 px tabular, "Next min R2 750" small, countdown, state badge. Tap → detail.
- Bid button: full width, 56 px tall, `cut-900`, label "Bid R2 750". Below it a "Enter a different amount" link that reveals a numeric input with the increment enforced client-side and re-validated server-side. Success pulses the card gold once.
- Bottom nav on auction pages: Lots · My bids · Pass.

### 5.3 Scanner (mobile, held in one hand)

- Camera fills the viewport; a 260 px viewfinder square with `gold-500` corners; event name and running count in a translucent bar at top.
- Result card slides up from the bottom for 2.5 s: green with check icon and name for success; sky with "Already checked in 18:42" for duplicates; red with "Not valid for this event" for invalid. Haptic via `navigator.vibrate` where supported.
- Tabs at the bottom, 64 px tall targets: Scan · Search · Walk-in · Count.
- Search: single field, results list with a "Check in" button per row.
- Walk-in: five fields max, consent checkbox with the wording from §7, big "Register and check in" button.

### 5.4 Projection (1920×1080, viewed from 20 m)

- Background `cut-950` with `watermark.png` centred at 6 % opacity.
- Header: logo plate left, auction title centre 40 px, live dot and clock right.
- **Grid mode:** 3 × 2 lot cards, each with image 40 % height, lot number and title 32 px, current bid 72 px tabular in gold, "Bidder 042" 28 px, countdown 28 px turning gold under 2 min. Cards that receive a bid flash a gold border for 1.5 s.
- **Spotlight mode:** image left 45 %, right side title 64 px, current bid 160 px gold, next minimum 40 px, countdown 48 px, last five bids as a list with bidder numbers.
- **Total mode:** "Raised so far" 48 px, amount 200 px gold, motto "Thinking Beyond" 40 px, vertical logo on plate.
- Footer ticker: last 8 bids as "Lot 3 · R5 500 · Bidder 017" chips, 28 px, sliding in from the right.
- No cursor, no scrollbars (`cursor: none; overflow: hidden`), and `Escape` never leaves fullscreen.
- Reconnection: a small `gold-500` "Reconnecting" pill at bottom left when the realtime channel drops; board never blanks.

### 5.5 Email

- 600 px table layout, logo top left on white, `cut-900` 6 px rule under the header, body 16 px, one primary button `cut-900` white text 48 px, footer with full university name, campus switchboards, unsubscribe line, and "Thinking Beyond".
- Pass email embeds the QR as an inline image and repeats the pass link as text.

---

## 6. Copy rules

- Voice: warm, formal, brief. Second person. "You are checked in. Welcome, Thabo." not "Check-in successful."
- Amounts: `R2 500`, `R12 750`, never `ZAR` or decimals unless cents exist.
- Dates: `Friday 30 October 2026, 18:00`. Times 24-hour.
- Never show a surname on any public or projected surface; attendee pages use first name; projection uses bidder numbers only.
- Consent wording (RSVP form, walk-in form), version `v1`:
  > I agree that Central University of Technology, Free State may contact me about this event by email and, if I have provided my number, by WhatsApp or SMS. I can withdraw this consent at any time. CUT processes personal information in line with POPIA.
- Auction terms, version `v1` (accepted on first bid):
  > Bids are binding offers to purchase the lot at the amount bid. The highest valid bid at close wins, subject to any reserve. Payment is due within 7 days. Lots are sold as described; CUT is not liable for donor-supplied items beyond the description. CUT is a public benefit organisation; a Section 18A certificate may be issued for the qualifying portion of a payment on request.

---

## 7. Accessibility

- All interactive targets ≥ 44 × 44 px on mobile.
- Colour never the only signal: badges carry text, countdown adds "closing soon".
- QR image has `alt="Your entry pass QR code"` and the token URL is also rendered as a link for screen readers and for phones with broken cameras.
- Projection text minimum 28 px; body pages minimum 14 px.
- Respect `prefers-reduced-motion`: disable pulses and ticker slide, keep instant updates.

---

## 8. Asset inventory (already in the repository)

Fetched from CUT by `scripts/fetch-brand-assets.{sh,ps1}`; provenance in `public/brand/SOURCES.md`:

| Path | What | Use |
|---|---|---|
| `public/brand/logo-h-{sm,md,lg}.png`, `logo-h-lg.jpg` | Horizontal logo, RGB on white | Console header, emails, pass page |
| `public/brand/logo-v-{sm,md,lg}.png` | Vertical logo | Projection idle, RSVP hero, icons |
| `public/brand/logo-hires.pdf` | Vector logo | Print: bidder cards, signage |
| `public/brand/logo-flat-{h,v}.jpg` | Flat (single-colour) application | Reference only |
| `public/brand/watermark.png` | Grey symbol + name, RGBA 1148×1485 | Projection background at 6–8 % opacity |
| `public/brand/spacing-guide.pdf` | Official spacing, isolation, minimum size, typeface | Reference |
| `public/brand/logo-20yrs-h-lg.png` | "20 years of Thinking Beyond" mark | Optional |
| `public/brand/favicon-src/*` | CUT website favicon set (16, 32, 180, ico, Safari mask SVG) | Copy to `app/` as `favicon.ico`, `icon.png`, `apple-icon.png` per Next.js conventions |

Generated by `scripts/generate-derived-assets.py` (re-run after any logo update):

| Path | What |
|---|---|
| `public/icons/icon-192.png`, `icon-512.png` | PWA icons: full vertical logo on a white rounded plate |
| `public/icons/icon-512-maskable.png` | Maskable variant with safe zone |
| `public/icons/apple-touch-icon.png` | 180 px, square plate |
| `public/og-image.png` | 1200×630 link preview: navy, logo plate, "CUT Events", motto |
| `public/placeholders/event-banner.jpg` | 1600×600 banner used when an event has no hero image |
| `supabase/seed/lots/lot-{1..6}.jpg` | 1200×900 branded placeholders for the six demo lots; replace with real item photos before the pilot |

Not vendored, loaded at build time by `next/font/google`: Barlow Condensed, Source Sans 3.

Still to be supplied by Institutional Advancement before the pilot (not needed for the demo): real lot photographs; the event hero image for the Gala; sponsor logos for the projection interstitial; the exact Section 18A wording Finance uses on receipts.

## 9. Files the design system produces

- `app/globals.css` — tokens, base styles, projection theme class `.theme-display`.
- `components/brand/Logo.tsx`, `BrandFrame.tsx` (top band used by attendee pages).
- `components/ui/*` — shadcn components generated with the mapping in §2.2.
- `lib/money.ts` — `formatZAR(n)`, `bidStep(table, current)`, `nextMinBid(...)`.
