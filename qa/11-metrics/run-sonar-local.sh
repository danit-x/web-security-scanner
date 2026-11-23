#!/usr/bin/env bash
# run-sonar-local.sh: EC4206 QA phase 11, local SonarQube fallback.
# Starts SonarQube Community Build in Docker, analyses the repo with the
# settings in sonar-project.properties, and saves the results as JSON in
# qa/evidence/sonar/latest/. Needs Docker and ~2 GB RAM. Nothing leaves the
# machine; the admin password and token are local throw-away values.
#   bash qa/11-metrics/run-sonar-local.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

HOST=http://127.0.0.1:9000
PASS="${SONAR_LOCAL_PASSWORD:-Local-Qa-Pass-2026!}"
KEY=danit-x_web-security-scanner
OUT=qa/evidence/sonar/latest

if ! docker ps --format '{{.Names}}' | grep -qx sonarqube; then
  docker run -d --name sonarqube -p 9000:9000 \
    -e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true sonarqube:community >/dev/null
fi
echo "waiting for SonarQube..."
until curl -s "$HOST/api/system/status" | grep -q '"status":"UP"'; do sleep 5; done

# First start only: replace the default admin/admin password.
curl -s -u admin:admin -X POST "$HOST/api/users/change_password" \
  -d login=admin -d previousPassword=admin --data-urlencode "password=$PASS" >/dev/null || true
A="admin:$PASS"

TOKEN=$(curl -s -u "$A" -X POST "$HOST/api/user_tokens/generate" \
  -d name="scan-$(date +%s)" -d type=GLOBAL_ANALYSIS_TOKEN | sed -E 's/.*"token":"([^"]+)".*/\1/')

# Create the project and use the stricter "Sonar way extended" rules (S3776).
curl -s -u "$A" -X POST "$HOST/api/projects/create" -d project=$KEY -d name="Website Security Scanner (EC4206 QA)" >/dev/null || true
curl -s -u "$A" -X POST "$HOST/api/qualityprofiles/add_project" \
  -d language=js -d qualityProfile="Sonar way extended" -d project=$KEY >/dev/null

node qa/11-metrics/fix-lcov-paths.js

docker run --rm --network host -e SONAR_HOST_URL=$HOST -e SONAR_TOKEN="$TOKEN" \
  -v "$PWD:/usr/src" sonarsource/sonar-scanner-cli \
  -Dsonar.organization= -Dsonar.scm.disabled=true

echo "waiting for the server to process the report..."
until curl -s -u "$A" "$HOST/api/ce/component?component=$KEY" | grep -q '"current":{[^}]*"status":"SUCCESS"'; do sleep 3; done

mkdir -p "$OUT"
M=bugs,vulnerabilities,security_hotspots,code_smells,coverage,line_coverage,branch_coverage,lines_to_cover,uncovered_lines,conditions_to_cover,uncovered_conditions,duplicated_lines_density,duplicated_lines,duplicated_blocks,complexity,cognitive_complexity,ncloc,lines,functions,files,sqale_index,sqale_debt_ratio,sqale_rating,reliability_rating,security_rating,alert_status,comment_lines_density
curl -s -u "$A" "$HOST/api/measures/component?component=$KEY&metricKeys=$M" > "$OUT/measures-project.json"
curl -s -u "$A" "$HOST/api/measures/component_tree?component=$KEY&qualifiers=FIL&ps=500&metricKeys=ncloc,complexity,cognitive_complexity,coverage,line_coverage,branch_coverage,duplicated_lines_density,bugs,code_smells,vulnerabilities" > "$OUT/measures-files.json"
curl -s -u "$A" "$HOST/api/issues/search?componentKeys=$KEY&ps=500" > "$OUT/issues.json"
curl -s -u "$A" "$HOST/api/hotspots/search?project=$KEY&ps=100" > "$OUT/hotspots.json"
echo "done: dashboard $HOST/dashboard?id=$KEY, JSON in $OUT/"
