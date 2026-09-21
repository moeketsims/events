#!/usr/bin/env bash
# One-time sign-in for the two CLIs that deploy the POC.
#
# Run this in your own terminal, not through Claude: each step opens a browser
# or prompts for a password, and the credential is stored by the CLI itself in
# its own config. Nothing is written into the repository and nothing passes
# through the assistant.
#
#   bash scripts/deploy-login.sh
set -uo pipefail
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

echo
echo "1/3  Supabase sign-in — approve in the browser window that opens."
pnpm exec supabase login || { echo "Supabase login failed."; exit 1; }

echo
echo "2/3  Link the dev project — paste the database password when prompted."
echo "     Project VxYOhTwf4HrJqwjr -> Project Settings -> Database."
pnpm exec supabase link --project-ref VxYOhTwf4HrJqwjr || { echo "Link failed."; exit 1; }

echo
echo "3/3  Vercel sign-in — choose your login method and approve in the browser."
pnpm exec vercel login || { echo "Vercel login failed."; exit 1; }

echo
echo "Signed in. Now paste ONE value into .deploy/secrets.env:"
echo "  SUPABASE_SECRET_KEY   dashboard -> Project Settings -> API Keys -> sb_secret_..."
echo "Then tell Claude \"done\", or run: bash scripts/deploy-dev.sh"
