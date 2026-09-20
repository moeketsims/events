# 05 — Handoff Prompt

Paste the block below as the first message to the implementing agent, opened in the `events` repository (`C:\Users\Moeketsi\Documents\events`, remote https://github.com/moeketsims/events.git). Fill the two placeholders first.

---

```
You are building the proof of concept of the CUT Events Platform for Central University of Technology, Free State. I am Moeketsi, the product owner. The planning is finished and every decision has been made; your job is to implement it, not to re-plan it.

## Start here, in this order
1. Read CLAUDE.md (rules and conventions).
2. Read PLAN.md (scope, what is in the POC, what is deferred to Stage B).
3. Read docs/01-BUILD-SPEC.md in full (repo layout, schema, SQL functions, RLS matrix, realtime topics, routes and payloads, providers, gotchas in §11b).
4. Read docs/02-DESIGN-SYSTEM.md (brand tokens, typography, logo rules, per-surface layouts, copy, asset inventory in §8).
5. Read docs/03-TASKS.md (25 tasks over four weeks, each with "Done when" criteria). This is your work queue; do it top to bottom.
6. Skim docs/04-DEMO-SCRIPT.md so you know what the finished POC must do in 15 minutes.

Do not summarise the documents back to me. After reading, your first message is the prerequisites request described below, and then you start T1.1.

## Prerequisites: ask once, then proceed
In a single message, ask me for everything you cannot get yourself:
- Supabase dev project: confirm the project reference and give me the sb_secret_... key. The publishable key is already in my global ~/.claude/CLAUDE.md.
- Email: I will use [Resend with the domain ______ | Brevo]. Give me exactly what you need (API key, SMTP credentials for Supabase Auth, the From address).
- Meta for Developers: WhatsApp test number PHONE_NUMBER_ID, temporary access token, app secret, and confirmation that these five demo phone numbers are added as test recipients: ______.
- Yoco sandbox secret key.
- Vercel: confirm the project is linked to github.com/moeketsims/events with production branch main, and that you can set environment variables there (or tell me the values to paste).
- GitHub Actions secrets for migrate.yml: SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD, SUPABASE_PROJECT_REF.

Then, without waiting, build everything that does not depend on those answers: scaffold, tokens, brand components, migrations written and pushed with whatever Supabase access you already have, token library, money library, unit tests, seed script, CI files. Wire providers as their keys arrive.

## How to work
- Follow docs/03-TASKS.md in order. Before starting a task, re-read its section in the build spec and design system. After finishing, perform every "Done when" check for real (run it, click it, scan it where you can; where a physical device is required, say so and I will do it), then tick the task in docs/03-TASKS.md and commit.
- Work on main in task-sized commits, message prefixed with the task id. Push after every task. Run pnpm lint && pnpm typecheck && pnpm test before every push. No attribution trailers in commits.
- Schema changes are migrations only. RLS on every table from creation. All bids through place_bid. Bidder numbers, never names, on any public or projected surface. Fictitious seed data only. Secrets in env only.
- Brand assets are already in public/brand and public/icons; do not re-download. Use the tokens and layouts in the design system exactly; if a component in the design system is ambiguous, pick the simplest reading and note it in the commit body.
- When the spec leaves a choice open it names a default; take the default. If you hit a genuine gap where two reasonable implementations would behave differently for the user, implement the one that keeps the demo script working and tell me in your weekly report. Do not stop to ask unless proceeding would be unsafe or would waste more than an hour if wrong.
- Real providers in sandbox mode, never mocks. If a provider is not yet configured, build the code path and the failing-gracefully behaviour (delivery row marked failed with error not_configured) so nothing else is blocked.

## Reporting
- At the end of each week's tasks (after T1.7, T2.7, T3.5, T4.5), stop and send me a short report: what is demo-able now with URLs, which "Done when" checks you could not perform yourself, what is blocked and on whom, and what you will do next. Then continue unless I redirect you.
- If anything in the documents turns out to be wrong against the real Supabase, Vercel, Meta, Resend or Yoco behaviour, fix the code, correct the document in the same commit, and mention it in the weekly report.

## Definition of done
Stage A is complete when everything in the "Definition of done for Stage A" section at the bottom of docs/03-TASKS.md is true, the demo in docs/04-DEMO-SCRIPT.md has run clean twice on real phones and a real external display, and the pre-demo checklist has been filled in.

## Where things stand (20 September 2026, night)
Weeks 1 and 2 (T1.1–T2.7) are done, verified in the browser against the local Docker Supabase stack, and pushed; CI is green. A polish pass followed Moeketsi's review. The design is binding: read docs/02-DESIGN-SYSTEM.md §2.4, §2.5 and §5.1 before touching any page, and reuse the components in components/brand and components/staff.

Read docs/06-IMPLEMENTATION-PLAN-WEEKS-3-4.md before starting: it inventories what already exists (every auction database function, the messaging layer, realtime types, feature flags in lib/features.ts) so you build on it rather than beside it, and it lays out each remaining task file by file with its local "Done when" checks. Resume at T3.1 (broadcasts). Unbuilt surfaces are gated by lib/features.ts; flip each flag in the commit that lands its route. Never run `next build` while the dev server is up (see CLAUDE.md).

Begin with the prerequisites message, then T3.1.
```

---

## Notes for Moeketsi before you paste it

- Fill in the email choice and the five demo phone numbers.
- Have the Supabase secret key, Meta credentials and Yoco sandbox key ready; the agent will ask for all of them in its first message.
- Configure Supabase Auth custom SMTP yourself if you would rather the agent never see SMTP credentials; the steps are in docs/01-BUILD-SPEC.md §4.9.
- The agent will stop four times for weekly reports. Each stop is a natural point to show progress to Institutional Advancement.
