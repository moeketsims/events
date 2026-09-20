# Fetch CUT official brand assets from the Corporate Identity page (https://www.cut.ac.za/ci)
# into public/brand/ and record provenance in public/brand/SOURCES.md.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$base = 'https://cms.cut.ac.za/Files/Froala'
$out = 'public/brand'
New-Item -ItemType Directory -Force $out | Out-Null

$files = [ordered]@{
  'logo-h-sm.png'       = '1a7a4583-9f6f-4192-afcf-f5245c7004f9.png'
  'logo-h-md.png'       = '5941062b-f35c-4019-a5ea-5ae1789c828c.png'
  'logo-h-lg.png'       = '3a4c840c-32a2-4565-8b82-7f508aa70212.png'
  'logo-h-lg.jpg'       = '2cac34dc-fbb4-4c13-827c-e2b273dd3cf6.jpg'
  'logo-v-sm.png'       = '2702ac94-812b-4916-88a9-c7123448141f.png'
  'logo-v-md.png'       = '29c1c39b-742d-416c-b9d9-ddc807d0e137.png'
  'logo-v-lg.png'       = 'd2637e85-ab3a-462b-a906-ba3bdc5e660a.png'
  'logo-hires.pdf'      = 'b7c75287-7990-4eca-b301-f0c1e431f236.pdf'
  'logo-flat-h.jpg'     = '2ca1c92e-ca82-4716-a4b1-c05c73766a1c.jpg'
  'logo-flat-v.jpg'     = '2c5c2db5-7310-4b8a-be2d-07bf9cecbde4.jpg'
  'watermark.png'       = '79a42300-c021-4a2a-8f45-2551a8cccff9.png'
  'spacing-guide.pdf'   = 'd8a64477-0af9-49f5-93b1-d15ff49102d7.pdf'
  'logo-20yrs-h-lg.png' = 'c360a262-0988-4f3e-bd1e-05ef3b8cebfe.png'
}

$lines = @(
  '# Brand asset sources', '',
  "Fetched $((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')) from CUT's Corporate Identity page https://www.cut.ac.za/ci.",
  'These files are the property of Central University of Technology, Free State and are used here',
  "under the institution's own brand rules for an internal CUT system. Do not redistribute.", '',
  '| File | Source URL | Bytes |', '|---|---|---|'
)
foreach ($name in $files.Keys) {
  $url = "$base/$($files[$name])"
  $dest = Join-Path $out $name
  try {
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
    $size = (Get-Item $dest).Length
    $lines += "| $name | $url | $size |"
    Write-Host "ok   $name ($size bytes)"
  } catch {
    $lines += "| $name | $url | FAILED |"
    Write-Host "FAIL $name"
  }
}
$lines | Out-File -Encoding utf8 (Join-Path $out 'SOURCES.md')
