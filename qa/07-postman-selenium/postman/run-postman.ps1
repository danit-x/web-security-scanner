# qa/07-postman-selenium/postman/run-postman.ps1
# Runs both Postman collections with the Postman CLI against the LOCAL QA API
# (qa-db, qa-api and qa-fixture must be running).
# Evidence: full console logs in qa/evidence/postman.
# No `postman login` needed, and --no-report-events means nothing about the run
# is sent to Postman's servers. (--output would need a login, so it is not used.)
$here = $PSScriptRoot
$out = Join-Path $here "..\..\evidence\postman"
New-Item -ItemType Directory -Force $out | Out-Null
$envFile = Join-Path $here "local.postman_environment.json"

# cmd /c keeps Windows PowerShell 5.1 from turning the CLI's stderr into errors.
function Invoke-Run($collection, $log, $extra) {
  $c = Join-Path $here $collection
  cmd /c "postman collection run `"$c`" -e `"$envFile`" --no-report-events --disable-unicode $extra > `"$out\$log`" 2>&1"
  $script:code = $LASTEXITCODE
  Get-Content "$out\$log" | Select-String -Pattern '\|\s+(iterations|requests|assertions)\s' | ForEach-Object { $_.Line }
}

"== API collection =="
Invoke-Run "websec-api.postman_collection.json" "api-run.log" "--timeout-request 15000"
$a = $script:code
"== Data-driven registration =="
Invoke-Run "websec-register-data-driven.postman_collection.json" "data-driven-run.log" "-d `"$(Join-Path $here 'register-cases.csv')`""
$b = $script:code

if ($a -ne 0 -or $b -ne 0) { "FAILED (exit codes: $a, $b)"; exit 1 } else { "ALL PASSED"; exit 0 }
