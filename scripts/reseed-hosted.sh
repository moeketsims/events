#!/usr/bin/env bash
# Rebuild the demo data on the hosted project, with the live origin baked into
# every QR code, and put real staff back in their department afterwards.
#
#   bash scripts/reseed-hosted.sh
#
# Use this rather than `pnpm seed` against the hosted project. The seed's
# teardown detaches every profile in the demo department, including real
# Institutional Advancement staff; this repairs that in the same breath.
set -euo pipefail
cd "$(dirname "$0")/.."

case "$(uname -r 2>/dev/null)" in
  *microsoft*|*Microsoft*|*WSL*)
    echo "This is a WSL shell, where Node is not installed. Use PowerShell."; exit 1;;
esac

[ -f .deploy/secrets.env ] || { echo "Missing .deploy/secrets.env"; exit 1; }
set -a; . .deploy/secrets.env; set +a
[ -n "${SUPABASE_PROJECT_REF:-}" ] || { echo "SUPABASE_PROJECT_REF missing"; exit 1; }

APP_URL="${APP_URL:-https://cut-events.vercel.app}"

echo
echo "== Reseeding $SUPABASE_PROJECT_REF with origin $APP_URL"
NEXT_PUBLIC_SUPABASE_URL="https://$SUPABASE_PROJECT_REF.supabase.co" \
SUPABASE_SECRET_KEY="$SUPABASE_SECRET_KEY" \
NEXT_PUBLIC_APP_URL="$APP_URL" \
PASS_SIGNING_SECRET="$PASS_SIGNING_SECRET" \
  pnpm seed

echo
echo "== Re-attaching real staff the teardown detached"
pnpm tsx scripts/reattach-staff.mts

echo
echo "== Mint a sign-in link when you are ready to record:"
echo "   pnpm tsx scripts/staff-link.mts organiser@demo.cut-events.test"
