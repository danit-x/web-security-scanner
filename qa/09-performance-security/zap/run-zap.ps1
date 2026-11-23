# qa/09-performance-security/zap/run-zap.ps1
# Runs the OWASP ZAP automation plan headless against the LOCAL QA stack.
# Needs running: qa-db (:27099), qa-fixture (:5070), the DAST API (:5060,
# node qa/scripts/start-dast-api.js) and the client production build
# (npm run preview --prefix client -- --port 4173).
param([string]$Zap = "C:\Program Files\ZAP\Zed Attack Proxy\zap.bat")

$here = $PSScriptRoot
$out = (New-Item -ItemType Directory -Force (Join-Path $here "..\..\evidence\zap")).FullName
$api = "http://127.0.0.1:5060/api"

# A logged-in test user with one saved scan, so ZAP can reach every endpoint.
$run = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$email = "zap.$run@example.com"
$reg = Invoke-RestMethod -Method Post "$api/auth/register" -ContentType "application/json" `
  -Body (@{ name = "Zap User"; email = $email; password = "Passw0rd1" } | ConvertTo-Json)
$scan = Invoke-RestMethod -Method Post "$api/scan" -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $($reg.token)" } `
  -Body (@{ url = "http://127.0.0.1:5070/"; ownershipConfirmed = $true } | ConvertTo-Json)

# Fill the ${ZAP_*} placeholders ourselves: ZAP does not substitute variables
# inside request headers. The rendered plan holds a throw-away test token, so it
# goes to the temp folder, not the repo.
$values = @{ ZAP_TOKEN = $reg.token; ZAP_EMAIL = $email; ZAP_RUN = "$run"; ZAP_SCAN_ID = $scan._id; ZAP_REPORT_DIR = $out }
$plan = Get-Content (Join-Path $here "zap-plan.yaml") -Raw
foreach ($k in $values.Keys) { $plan = $plan.Replace("`${$k}", $values[$k]) }
$rendered = Join-Path $env:TEMP "zap-plan.rendered.yaml"
Set-Content -Path $rendered -Value $plan -Encoding utf8

# A FRESH ZAP home dir on every run (no personal settings, no state from earlier
# runs), own proxy port, no update checks. Rules created by automation jobs
# (e.g. replacer rules) are saved in the home dir's config.xml and silently
# apply to later runs; a stale rule once overwrote the Bearer header and made
# every authenticated request 401.
$home_ = "C:\tools\zap-home"
if (Test-Path $home_) { Remove-Item -Recurse -Force $home_ }
New-Item -ItemType Directory -Force $home_ | Out-Null
# zap.bat finds its jar relative to the current directory, so run it from ZAP's folder.
cmd /c "cd /d `"$(Split-Path $Zap)`" && `"$Zap`" -cmd -dir `"$home_`" -port 8095 -config start.checkForUpdates=false -autorun `"$rendered`" > `"$out\zap-console.log`" 2>&1"
"ZAP exit code: $LASTEXITCODE"
Remove-Item $rendered -ErrorAction SilentlyContinue
Get-Content "$out\zap-console.log" | Select-String "Job .* (started|finished)|alerts|WARN|ERROR" | Select-Object -Last 25
