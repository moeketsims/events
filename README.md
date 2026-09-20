# CUT Events Platform

Event management for Central University of Technology, Free State: invitations and RSVP, QR check-in, live broadcasts (in-app and WhatsApp), and digital silent auctions projected live. Built for the Institutional Advancement unit; usable by every department.

**Status:** planning complete, proof of concept not yet started. Target demo event: CUT Fundraising Gala Dinner, 30 October 2026.

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

## Assets

`public/brand/` holds CUT's official logo files, watermark, spacing guide and favicon set, fetched from https://www.cut.ac.za/ci by `scripts/fetch-brand-assets.{sh,ps1}`; provenance is in `public/brand/SOURCES.md`. These files belong to the university and are used under its brand rules for an internal CUT system. `scripts/generate-derived-assets.py` produces the PWA icons, link-preview image and placeholders from them.

## Stack

Next.js 15 (TypeScript) on Vercel · Supabase (Postgres, Auth, Realtime, Storage, cron) · Tailwind 4 + shadcn/ui · Resend · Meta WhatsApp Cloud API · Yoco. Free tiers for the POC; see PLAN.md §5.1 for the production cost line.
