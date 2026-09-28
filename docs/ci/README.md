# CI integration

Send automated results to TestHub from any CI. The helper
[`scripts/gauge-ingest.mjs`](../../scripts/gauge-ingest.mjs) parses a report and
POSTs it to `/api/ingest`, including **Gauge per-step results** and **screenshots
as evidence**.

## 1. Create an API token

Project → **Settings → API tokens → Create**. Copy the `th_…` token and store it
as a CI secret (e.g. `TESTHUB_TOKEN`).

## 2. Run Gauge and ingest

```bash
gauge run --machine-readable specs > gauge.ndjson

node scripts/gauge-ingest.mjs \
  --report gauge.ndjson \
  --token "$TESTHUB_TOKEN" \
  --run-name "CI #$BUILD_NUMBER" \
  --environment CI \
  --screenshots reports/html-report/images
```

Options: `--api-url` (defaults to `https://testhub-one.vercel.app`, or
`TESTHUB_API_URL`), `--type gauge|junit` (default `gauge`), `--dry-run` to preview
the payload.

Test cases are matched by key (`PROJ-12`) in the scenario name/spec file, falling
back to an exact title match. Attach a Jira-style tag (e.g. `tags: SCRUM-7`) to a
scenario to pin screenshots to the right case; otherwise screenshots attach to the
single matched case.

## 3. Examples

- [GitHub Actions](github-actions.yml)
- [GitLab CI](gitlab-ci.yml)
- [Jenkins](jenkins.groovy)

For non-Gauge suites, send JUnit instead:

```bash
node scripts/gauge-ingest.mjs --type junit --report junit.xml --token "$TESTHUB_TOKEN"
```
