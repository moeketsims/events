# CUT Events Platform — instructions for the implementing agent

You are building the proof of concept for an event management platform for Central University of Technology, Free State (CUT). The product owner is Moeketsi. The client is CUT's Institutional Advancement unit.

## Read these first, in order
1. `PLAN.md` — why, scope, roadmap, what is deferred.
2. `docs/01-BUILD-SPEC.md` — repo layout, schema, functions, RLS, routes, contracts, providers. This is the technical contract.
3. `docs/02-DESIGN-SYSTEM.md` — brand tokens, typography, logo rules, per-surface layouts, copy rules.
4. `docs/03-TASKS.md` — the week-by-week task list with acceptance criteria. Work through it top to bottom.
5. `docs/04-DEMO-SCRIPT.md` — what the finished POC must be able to do in 15 minutes.
6. `docs/06-IMPLEMENTATION-PLAN-WEEKS-3-4.md` — what already exists for Weeks 3–4 and the file-by-file plan for each remaining task. Read before T3.1.
7. `docs/07-IMPLEMENTATION-PLAN-SELF-REGISTRATION.md` — T3.6 self-registration by event QR (build before T4.1) and T4.6 WhatsApp, moved to last. Read before T3.6.

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
- **Design is settled and binding.** Read `docs/02-DESIGN-SYSTEM.md` §2.4, §2.5 and §5.1 before building any page. Public and attendee surfaces use the cinematic layer (`Atmosphere`, glass panels, metallic gold); the console uses the v3 card vocabulary (ledger, ticket, seat map, desk). No icon-chip stat boxes. No figures on public pages.
- **Never run `next build` while `pnpm dev` is running.** Both write to `.next`; a build under a live dev server leaves it serving pages whose client chunks 404, so nothing hydrates. If that happens: stop the dev server, delete `.next`, start it again and wait for the first compile before opening a page.

## Working conventions
- pnpm, Node 22, TypeScript strict, Next.js 15 App Router, Tailwind 4, shadcn/ui.
- Work on `main` in task-sized commits; push after every task so CI and Vercel run. Use a PR only for a change you want CI to gate first.
- Run `pnpm lint && pnpm typecheck && pnpm test` before every push.
- Commit messages: imperative mood, prefixed with the task id, one line under 72 chars, body only when needed. No attribution trailers.
- When you finish a task, perform its "Done when" checks for real, then tick it in `docs/03-TASKS.md` in the same commit.
- At the end of each week's tasks, stop and report to Moeketsi: what is demo-able, what is blocked, what you need.
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
