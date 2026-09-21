# One-time sign-in for the two CLIs that deploy the POC (Windows PowerShell).
#
# Run this in a PowerShell window, not through Claude and not in WSL: each step
# opens a browser or prompts for a password, and the credential is stored by the
# CLI itself. Nothing is written into the repository.
#
#   powershell -ExecutionPolicy Bypass -File scripts\deploy-login.ps1
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "`n1/3  Supabase sign-in - approve in the browser window that opens." -ForegroundColor Cyan
pnpm exec supabase login
if ($LASTEXITCODE -ne 0) { Write-Host "Supabase login failed." -ForegroundColor Red; exit 1 }

Write-Host "`n2/3  Link the dev project - paste the database password when prompted." -ForegroundColor Cyan
Write-Host "     Project VxYOhTwf4HrJqwjr -> Project Settings -> Database."
pnpm exec supabase link --project-ref VxYOhTwf4HrJqwjr
if ($LASTEXITCODE -ne 0) { Write-Host "Link failed." -ForegroundColor Red; exit 1 }

Write-Host "`n3/3  Vercel sign-in - choose your login method and approve in the browser." -ForegroundColor Cyan
pnpm exec vercel login
if ($LASTEXITCODE -ne 0) { Write-Host "Vercel login failed." -ForegroundColor Red; exit 1 }

Write-Host "`nSigned in. Now paste ONE value into .deploy\secrets.env:" -ForegroundColor Green
Write-Host "  SUPABASE_SECRET_KEY   dashboard -> Project Settings -> API Keys -> sb_secret_..."
Write-Host 'Then tell Claude "done".'
