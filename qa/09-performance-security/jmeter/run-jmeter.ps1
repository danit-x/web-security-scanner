# qa/09-performance-security/jmeter/run-jmeter.ps1 [-Scenario smoke|load|stress|spike|all]
# Runs the JMeter plan in non-GUI mode against the LOCAL QA API and builds an
# HTML dashboard per run in qa/evidence/jmeter/<scenario>/report.
# Needs: qa-db, qa-api (:5000), qa-fixture (:5070) running; JMeter in C:\tools.
param([string]$Scenario = "all", [string]$JMeter = "C:\tools\apache-jmeter-5.6.3\bin\jmeter.bat")

$here = $PSScriptRoot
$plan = Join-Path $here "websec-load.jmx"
$evidence = Join-Path $here "..\..\evidence\jmeter"

# users / ramp-up (s) / duration (s) / scan users
$scenarios = [ordered]@{
  "smoke"      = @{ users = 5;   rampup = 5;  duration = 30;  scanUsers = 1 }
  "load"       = @{ users = 50;  rampup = 30; duration = 120; scanUsers = 10 }
  "stress-100" = @{ users = 100; rampup = 30; duration = 90;  scanUsers = 0 }
  "stress-200" = @{ users = 200; rampup = 30; duration = 90;  scanUsers = 0 }
  "stress-400" = @{ users = 400; rampup = 30; duration = 90;  scanUsers = 0 }
  "spike"      = @{ users = 150; rampup = 5;  duration = 60;  scanUsers = 0 }
  # Not part of "all": pushes sign-up/login (bcrypt) past capacity on purpose.
  "breakpoint" = @{ users = 800; rampup = 10; duration = 60;  scanUsers = 0 }
}
$selected = switch ($Scenario) {
  "all"    { $scenarios.Keys | Where-Object { $_ -notin "smoke", "breakpoint" } }
  "stress" { $scenarios.Keys | Where-Object { $_ -like "stress-*" } }
  default  { @($Scenario) }
}

foreach ($name in $selected) {
  $s = $scenarios[$name]
  $out = Join-Path $evidence $name
  if (Test-Path $out) { Remove-Item -Recurse -Force $out }
  New-Item -ItemType Directory -Force $out | Out-Null
  "== $name : $($s.users) users, ramp $($s.rampup)s, $($s.duration)s, scan users $($s.scanUsers) =="
  cmd /c "`"$JMeter`" -n -t `"$plan`" -l `"$out\results.jtl`" -j `"$out\jmeter.log`" -e -o `"$out\report`" -Jusers=$($s.users) -Jrampup=$($s.rampup) -Jduration=$($s.duration) -JscanUsers=$($s.scanUsers) > `"$out\console.txt`" 2>&1"
  Get-Content "$out\console.txt" | Select-String "summary =|Err:" | Select-Object -Last 1 | ForEach-Object { $_.Line }
}
