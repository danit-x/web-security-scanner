# run-sonar-local.ps1: EC4206 QA phase 11, local SonarQube fallback (Windows).
# Same steps as run-sonar-local.sh. Needs Docker Desktop running.
#   powershell -File qa/11-metrics/run-sonar-local.ps1
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..\..")

$HostUrl = "http://localhost:9000"
$Pass = if ($env:SONAR_LOCAL_PASSWORD) { $env:SONAR_LOCAL_PASSWORD } else { "Local-Qa-Pass-2026!" }
$Key = "danit-x_web-security-scanner"
$Out = "qa/evidence/sonar/latest"

if (-not (docker ps --format "{{.Names}}" | Select-String -Pattern "^sonarqube$" -Quiet)) {
  docker run -d --name sonarqube -p 9000:9000 -e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true sonarqube:community | Out-Null
}
Write-Host "waiting for SonarQube..."
do { Start-Sleep 5; $s = try { (Invoke-RestMethod "$HostUrl/api/system/status").status } catch { "" } } until ($s -eq "UP")

function Basic($u, $p) { @{ Authorization = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${u}:${p}")) } }
try { Invoke-RestMethod -Method Post "$HostUrl/api/users/change_password" -Headers (Basic "admin" "admin") -Body @{ login = "admin"; previousPassword = "admin"; password = $Pass } | Out-Null } catch {}
$H = Basic "admin" $Pass

$Token = (Invoke-RestMethod -Method Post "$HostUrl/api/user_tokens/generate" -Headers $H -Body @{ name = "scan-$(Get-Date -UFormat %s)"; type = "GLOBAL_ANALYSIS_TOKEN" }).token
try { Invoke-RestMethod -Method Post "$HostUrl/api/projects/create" -Headers $H -Body @{ project = $Key; name = "Website Security Scanner (EC4206 QA)" } | Out-Null } catch {}
Invoke-RestMethod -Method Post "$HostUrl/api/qualityprofiles/add_project" -Headers $H -Body @{ language = "js"; qualityProfile = "Sonar way extended"; project = $Key } | Out-Null

node qa/11-metrics/fix-lcov-paths.js

docker run --rm -e SONAR_HOST_URL=http://host.docker.internal:9000 -e SONAR_TOKEN=$Token `
  -v "${PWD}:/usr/src" sonarsource/sonar-scanner-cli -Dsonar.organization= -Dsonar.scm.disabled=true

Write-Host "waiting for the server to process the report..."
do { Start-Sleep 3; $ce = Invoke-RestMethod "$HostUrl/api/ce/component?component=$Key" -Headers $H } until ($ce.current.status -eq "SUCCESS")

New-Item -ItemType Directory -Force $Out | Out-Null
$M = "bugs,vulnerabilities,security_hotspots,code_smells,coverage,line_coverage,branch_coverage,duplicated_lines_density,duplicated_blocks,complexity,cognitive_complexity,ncloc,functions,files,sqale_index,sqale_rating,reliability_rating,security_rating,alert_status"
Invoke-WebRequest "$HostUrl/api/measures/component?component=$Key&metricKeys=$M" -Headers $H -OutFile "$Out/measures-project.json"
Invoke-WebRequest "$HostUrl/api/issues/search?componentKeys=$Key&ps=500" -Headers $H -OutFile "$Out/issues.json"
Invoke-WebRequest "$HostUrl/api/hotspots/search?project=$Key&ps=100" -Headers $H -OutFile "$Out/hotspots.json"
Write-Host "done: dashboard $HostUrl/dashboard?id=$Key, JSON in $Out/"
