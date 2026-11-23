# SonarCloud setup (one-off)

SonarCloud is free for public repositories. The CI job `sonar` in `.github/workflows/qa.yml` is already in place and does nothing until these steps are done, so CI stays green meanwhile.

## Who does what

| Step | Who | Why |
|---|---|---|
| 1–3 | **Repo owner (Danith)** | Only the owner of the `danit-x` GitHub account can install the SonarCloud app on it |
| 4 | Owner, or any repo **admin** | Only admins can see *Settings → Secrets* |
| 5 | Anyone | Check the result |

## Steps

1. Go to <https://sonarcloud.io>, click **Log in → GitHub**, and approve.
2. Click **+** (top right) → **Analyze new project** → **Import an organization from GitHub**. Choose the **danit-x** account, select **Only select repositories → web-security-scanner**, and click **Install**. Choose the **Free** plan. Keep the organization key `danit-x`.
3. Tick **web-security-scanner** → **Set up**. For "new code" choose **Previous version**. When asked how to analyse, choose **With GitHub Actions** (*not* Automatic Analysis: if Automatic Analysis is on, the CI scan fails with "You are running CI analysis while Automatic Analysis is enabled". Turn it off under *Administration → Analysis Method* if needed).
4. SonarCloud shows a **SONAR_TOKEN** value. On GitHub open the repo → **Settings → Secrets and variables → Actions → New repository secret**. Set Name = `SONAR_TOKEN`, Secret = the value. **Never** paste the token in a file, commit, issue or chat: the repo is public.
5. Re-run the latest *QA pipeline* run on `qa/ec4206-testing` (Actions tab → run → *Re-run all jobs*). The `Static analysis (SonarCloud)` job now uploads the analysis. Open <https://sonarcloud.io/project/overview?id=danit-x_web-security-scanner>.

## Rule set (quality profile)

The Phase 11 report uses **Sonar way extended**, which includes S3776 (cognitive complexity, the `runScan` finding) and S8786 (regex backtracking). SonarCloud analyses with its built-in **Sonar way** profile unless told otherwise. In the local core profile these two rules are not active, so CI could report fewer code smells than the report. To make SonarCloud match:

1. In SonarCloud open the **danit-x** organization → **Quality Profiles** → **JavaScript** → **Sonar way** → ⋮ → **Extend**, and name it `EC4206 extended`.
2. In the new profile click **Activate more rules**, search for **S3776** and **S8786**, and activate both (keep the S3776 threshold at 15).
3. Project **web-security-scanner** → **Administration → Quality Profiles** → set JavaScript to `EC4206 extended`.
4. Re-run the `sonar` job. Code smells should then match the report (4).

If this is not done, remember that SonarCloud findings can differ from the report because the rule set differs, not the code.

If SonarCloud shows a different **project key** or **organization key** than `danit-x_web-security-scanner` / `danit-x`, change the two lines at the top of `sonar-project.properties` to match.

## Fallback

If SonarCloud cannot be set up, `bash qa/11-metrics/run-sonar-local.sh` (or `run-sonar-local.ps1` on Windows with Docker Desktop) runs the same analysis on a local SonarQube Community Build. The Phase 11 report numbers come from that run.
