# CUT Events Platform

Event management for Central University of Technology, Free State: invitations and RSVP, QR check-in, live broadcasts (in-app and WhatsApp), and digital silent auctions projected live. Built for the Institutional Advancement unit; usable by every department.

**Status:** Stage A (proof of concept) in progress. Target demo event: CUT Fundraising Gala Dinner, 30 October 2026.

## Documents

| File | Purpose |
|---|---|
| [PLAN.md](PLAN.md) | Strategy, requirements synthesis, architecture, two-stage roadmap (free-tier POC → production), risks, open questions |
| [docs/01-BUILD-SPEC.md](docs/01-BUILD-SPEC.md) | Technical contract: repo layout, schema and SQL functions, RLS matrix, realtime topics, routes and payloads, providers |
| [docs/02-DESIGN-SYSTEM.md](docs/02-DESIGN-SYSTEM.md) | CUT brand facts and rules, tokens, typography, logo usage, per-surface layouts, copy, asset inventory |
| [docs/03-TASKS.md](docs/03-TASKS.md) | Four weeks of tasks with acceptance criteria |
| [docs/04-DEMO-SCRIPT.md](docs/04-DEMO-SCRIPT.md) | The 15-minute demo, kit, pre-demo checklist, recovery moves |
| [docs/05-HANDOFF-PROMPT.md](docs/05-HANDOFF-PROMPT.md) | The prompt that starts the implementing agent |
| [CLAUDE.md](CLAUDE.md) | Rules and conventions for the implementing agent |

## Getting started

Requires **Node 22+** and **pnpm 10+**.

```bash
pnpm install
cp .env.example .env.local     # then fill in the values below
pnpm dev                       # http://localhost:3000
```

Generate the two secrets the app owns itself:

```bash
node -e "const c=require('node:crypto');console.log('PASS_SIGNING_SECRET='+c.randomBytes(48).toString('base64'));console.log('CRON_SECRET='+c.randomBytes(32).toString('base64url'))"
```

Everything else comes from a provider dashboard; see [docs/01-BUILD-SPEC.md §3](docs/01-BUILD-SPEC.md) for the full table. Rotating `PASS_SIGNING_SECRET` invalidates every issued pass and RSVP link.

### Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Development server on http://localhost:3000 |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm lint` | ESLint (Next core-web-vitals + TypeScript, Prettier-compatible) |
| `pnpm typecheck` | `tsc --noEmit`, strict |
| `pnpm test` | Vitest unit tests |
| `pnpm format` | Prettier write |
| `pnpm db:push` | `supabase db push` to the linked dev project |
| `pnpm db:types` | Regenerate `lib/db/types.ts` from the linked project |
| `pnpm seed` | Rebuild the demo data |
| `pnpm bid-storm` | Concurrency test against `place_bid` |
| `pnpm smoke-providers` | One live call to each configured provider |

Run `pnpm lint && pnpm typecheck && pnpm test` before every push.

### Surfaces

| Path | Who | Auth |
|---|---|---|
| `/login`, `/dashboard`, `/contacts`, `/events/…`, `/settings` | Staff | Supabase Auth email OTP |
| `/scan`, `/scan/[eventId]` | Door staff | Supabase Auth email OTP, role `door_staff` or above |
| `/rsvp/[token]` | Invitee | Signed RSVP token in the URL |
| `/p/[token]` and sub-pages | Attendee | Signed pass token in the URL, mirrored to an httpOnly cookie |
| `/display/[auctionId]?k=…` | Projection laptop | Display key on the auction row |
| `/styleguide` | Developers | Development builds only |

### Supabase dashboard configuration

These are one-time settings that are **not** in a migration because they are not schema (BUILD-SPEC §4.9). Record any change here.

- [ ] **Auth → SMTP**: custom SMTP configured. The built-in mailer is limited to a few messages an hour on the free tier and will break OTP login during a demo. Resend: `smtp.resend.com`, port 465, user `resend`, password = the Resend API key, sender = `EMAIL_FROM`. Brevo: the Brevo SMTP relay instead.
- [ ] **Auth → Email templates → Magic Link**: includes `{{ .Token }}` so the 6-digit code is delivered, and keeps `{{ .ConfirmationURL }}` so the link still works.
- [ ] **Auth → URL configuration**: Site URL = `NEXT_PUBLIC_APP_URL`; redirect URLs include `http://localhost:3000/**` and the Vercel preview pattern.
- [ ] **Auth → Providers → Email**: public sign-ups disabled. Staff accounts are created by the seed or by a platform admin in `/settings`.
- [ ] **Realtime**: public channels allowed, so `realtime.send` reaches the projection and attendee pages. If this cannot be enabled, set `NEXT_PUBLIC_REALTIME_MODE=poll`.

## Assets

`public/brand/` holds CUT's official logo files, watermark, spacing guide and favicon set, fetched from https://www.cut.ac.za/ci by `scripts/fetch-brand-assets.{sh,ps1}`; provenance is in `public/brand/SOURCES.md`. These files belong to the university and are used under its brand rules for an internal CUT system. `scripts/generate-derived-assets.py` produces the PWA icons, link-preview image and placeholders from them.

The logo enters the product only through `components/brand/Logo.tsx`, which carries the CI rules with it: minimum sizes, the inseparable symbol-and-name unit, and the white plate required on any non-white background.

## Stack

Next.js 15 (App Router, TypeScript strict) on Vercel · Supabase (Postgres, Auth, Realtime, Storage, cron) · Tailwind 4 + shadcn/ui · Resend or Brevo · Meta WhatsApp Cloud API · Yoco. Free tiers for the POC; see [PLAN.md §5.1](PLAN.md) for the production cost line.
