# CUT Events Platform — instructions for the implementing agent

You are building the proof of concept for an event management platform for Central University of Technology, Free State (CUT). The product owner is Moeketsi. The client is CUT's Institutional Advancement unit.

## Read these first, in order
1. `PLAN.md` — why, scope, roadmap, what is deferred.
2. `docs/01-BUILD-SPEC.md` — repo layout, schema, functions, RLS, routes, contracts, providers. This is the technical contract.
3. `docs/02-DESIGN-SYSTEM.md` — brand tokens, typography, logo rules, per-surface layouts, copy rules.
4. `docs/03-TASKS.md` — the week-by-week task list with acceptance criteria. Work through it top to bottom.
5. `docs/04-DEMO-SCRIPT.md` — what the finished POC must be able to do in 15 minutes.

If the spec and the plan disagree, the spec wins for technical matters and the plan wins for scope. If something is genuinely undecided, pick the default the spec names and note the decision in the PR description.

## Non-negotiable rules
- **Migrations only.** Every schema change is a new file in `supabase/migrations/`. Never change the schema in the Supabase dashboard.
- **RLS on every table** from the migration that creates it. Attendee-facing pages use the admin client server-side and return only the fields the spec lists.
- **Secrets in env, never in code or git.** `.env.local` is ignored. `.env.example` lists every variable.
- **Two Supabase projects.** Dev/POC now; a separate empty production project at graduation, populated by the same migrations.
- **Real providers in sandbox/test mode**, not mocks. Resend (or Brevo), Meta WhatsApp Cloud API test number, Yoco sandbox.
- **No real personal data.** Seed data is fictitious (`@example.com`, `+27820000…`).
- **Anonymity on public surfaces.** Bidder numbers only on the projection and in realtime payloads. Never a surname on a public page.
- **One bid path.** All bids go through the `place_bid` Postgres function. No client-side or server-side shortcut.
- Every Server Action and Route Handler validates input with zod. Every role-restricted action calls `requireStaff`.

## Working conventions
- pnpm, Node 22, TypeScript strict, Next.js 15 App Router, Tailwind 4, shadcn/ui.
- One task from `docs/03-TASKS.md` per branch and PR. Branch name `t<week>-<n>-<slug>`. Squash-merge.
- Run `pnpm lint && pnpm typecheck && pnpm test` before opening a PR.
- Commit messages: imperative mood, one line under 72 chars, body only when needed.
- When you finish a task, tick it in `docs/03-TASKS.md` in the same PR.
- Ask for prerequisites you lack (keys, domain, test phone numbers) in a single message at the start, then build everything that does not depend on them.

## Useful commands
```bash
pnpm dev                 # http://localhost:3000
pnpm db:push             # supabase db push (linked dev project)
pnpm db:types            # regenerate lib/db/types.ts
pnpm seed                # rebuild demo data
pnpm test                # vitest
pnpm bid-storm           # concurrency test against the dev project
```

## Environment
- The Supabase dev project reference and publishable key are in the user's global `~/.claude/CLAUDE.md`. Ask the user for the `sb_secret_…` key; do not guess it.
- Deployment target: Vercel, project linked to https://github.com/moeketsims/events.git, production branch `main`.
- Time zone for all display: `Africa/Johannesburg`. Currency ZAR, formatted `R2 500`.

## Target event for the demo
CUT Fundraising Gala Dinner, Friday 30 October 2026, 18:00, CUT Hotel School, Bloemfontein. The seed mirrors it as "(Demo)".
