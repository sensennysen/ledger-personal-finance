# Local browser QA runner

These scripts are QA artifacts, not application fixes. They run against `http://127.0.0.1:5173` and local Supabase at port 54321. All Supabase migrations must already be applied. `.env.development.local` supplies the local public API key; the scripts reject a nonlocal API URL.

```powershell
pnpm --dir docs/qa/runner install
$env:QA_OUT = 'docs/qa/runs/my-new-run'
node docs/qa/runner/run.mjs
```

The functional runner creates unique local QA users and records. It uses installed Google Chrome in an isolated headless profile. It returns exit code 1 for assertion failures and preserves screenshots/results. It leaves test data available for investigation. It never logs authentication tokens. Do not publish raw browser session state or private credentials.

Feature checks reuse the fixture from a completed primary run:

```powershell
$env:QA_BASE_RUN = 'docs/qa/runs/my-new-run/results.json'
$env:QA_OUT = 'docs/qa/runs/my-feature-run'
# Optional: comma-separated case IDs, e.g. F-019c. Omit for all feature cases.
$env:QA_ONLY = 'F-019c'
node docs/qa/runner/features.mjs
```

Feature tests mutate their fixture and some create named records, so use a fresh primary fixture for a fresh full feature run. The receipt case uploads a synthetic one-pixel PNG. The reimport case uses an actual CSV artifact exported by the primary run.

```powershell
$env:QA_VISUAL_OUT = 'docs/qa/runs/my-visual-run'
node docs/qa/runner/visual.mjs
```

The visual runner uses the seeded demo account, changes that account's theme, and captures 10 routes at three sizes in two themes. It reuses the existing repository contrast scan, preserving its limitations (including omitted SVG text/focus-ring checks). It resumes existing results in its output directory; use a new directory for a fresh run. A screenshot/contrast sweep is not approval of a visual baseline or verification of all offscreen/modal states.

Current browser coverage is Chrome only. Firefox/WebKit download failed during the recorded run; physical devices were unavailable. The full inventory and the authoritative result classification live in [the tracker](../e2e-test-tracker.md) and [the consolidated report](../runs/QA-20261006-summary.md). Earlier raw logs contain test-selector failures that were corrected and retested; do not count them as confirmed product defects.
