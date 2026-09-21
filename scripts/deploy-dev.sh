#!/usr/bin/env bash
# Deploy the POC to the hosted Supabase dev project and Vercel — PLAN.md §6,
# BUILD-SPEC §1.
#
# Prerequisites, done once by Moeketsi in a terminal (see scripts/deploy-login.sh):
#   pnpm exec supabase login                                  # OAuth; CLI stores the token
#   pnpm exec supabase link --project-ref <ref>               # prompts for the DB password, CLI stores it
#   pnpm exec vercel login                                    # OAuth; CLI stores the token
#
# The only value this script reads is SUPABASE_SECRET_KEY, from the gitignored
# .deploy/secrets.env, because it has to become a Vercel environment variable.
# Nothing from that file is ever printed. Re-runnable: every step is an upsert.
#
#   bash scripts/deploy-dev.sh            # everything
#   bash scripts/deploy-dev.sh --no-seed  # skip the demo seed
set -euo pipefail
cd "$(dirname "$0")/.."

# Node is installed on Windows, not inside WSL, so a WSL shell finds the pnpm
# shim but no node and fails with "exec: node: not found". Say so plainly.
case "$(uname -r 2>/dev/null)" in
  *microsoft*|*Microsoft*|*WSL*)
    echo "This is a WSL shell, where Node is not installed."
    echo "Open PowerShell in this folder and run the commands there instead."
    exit 1;;
esac
command -v node >/dev/null 2>&1 || { echo "node is not on PATH in this shell. Use PowerShell."; exit 1; }

PROJECT=cut-events

step() { printf '\n== %s\n' "$1"; }
fail() { printf '\n!! %s\n' "$1"; exit 1; }

[ -f .deploy/secrets.env ] || fail "Missing .deploy/secrets.env"
set -a; . .deploy/secrets.env; set +a
for v in SUPABASE_PROJECT_REF SUPABASE_SECRET_KEY SUPABASE_PUBLISHABLE_KEY; do
  [ -n "${!v:-}" ] || fail "$v missing from .deploy/secrets.env"
done
REF="$SUPABASE_PROJECT_REF"
SUPABASE_URL="https://$REF.supabase.co"
[ -n "${PASS_SIGNING_SECRET:-}" ] || fail "PASS_SIGNING_SECRET missing from .deploy/secrets.env"
[ -n "${CRON_SECRET:-}" ] || fail "CRON_SECRET missing from .deploy/secrets.env"

step "Check both CLIs are signed in"
pnpm exec supabase projects list >/dev/null 2>&1 \
  || fail "Supabase CLI not signed in. Run: pnpm exec supabase login"
pnpm exec vercel whoami >/dev/null 2>&1 \
  || fail "Vercel CLI not signed in. Run: pnpm exec vercel login"
echo "  both signed in"

step "Push migrations 0001-0010 to $REF"
pnpm exec supabase db push --linked
pnpm exec supabase migration list --linked | tail -14

step "Link the Vercel project"
pnpm exec vercel link --yes --project "$PROJECT" >/dev/null
APP_URL="https://$PROJECT.vercel.app"
echo "  $APP_URL"

step "Production environment"
setenv() { # name value
  pnpm exec vercel env rm "$1" production --yes >/dev/null 2>&1 || true
  printf '%s' "$2" | pnpm exec vercel env add "$1" production >/dev/null
  printf '  %s\n' "$1"
}
setenv NEXT_PUBLIC_SUPABASE_URL "$SUPABASE_URL"
setenv NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY "$SUPABASE_PUBLISHABLE_KEY"
setenv SUPABASE_SECRET_KEY "$SUPABASE_SECRET_KEY"
setenv NEXT_PUBLIC_APP_URL "$APP_URL"
setenv NEXT_PUBLIC_REALTIME_MODE "broadcast"
setenv PASS_SIGNING_SECRET "$PASS_SIGNING_SECRET"
setenv CRON_SECRET "$CRON_SECRET"
setenv EMAIL_PROVIDER "resend"
setenv EMAIL_FROM "CUT Events <events@example.com>"

step "Connect the GitHub repository (deploys on every push to main)"
pnpm exec vercel git connect --yes 2>&1 | tail -2 || true

step "Production deploy"
pnpm exec vercel deploy --prod --yes 2>&1 | tail -3

step "Supabase Auth: sign-in links must point at the live site"
NEXT_PUBLIC_APP_URL="$APP_URL" pnpm exec supabase config push 2>&1 | tail -3 \
  || echo "  Could not push auth config. Set Site URL to $APP_URL by hand in the dashboard."

if [ "${1:-}" != "--no-seed" ]; then
  step "Seed the hosted project, with the live origin baked into the QR codes"
  NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_SECRET_KEY="$SUPABASE_SECRET_KEY" \
  NEXT_PUBLIC_APP_URL="$APP_URL" \
  PASS_SIGNING_SECRET="$PASS_SIGNING_SECRET" \
    pnpm seed
fi

step "Live at $APP_URL"
