# TestHub for Jira (Forge issue panel)

A [Forge](https://developer.atlassian.com/platform/forge/) app that adds a
**TestHub coverage** panel to Jira issue pages, showing the tests linked to the
issue, their latest results and linked bugs. It calls the TestHub coverage API
(`/api/v1/jira/coverage?key=<ISSUE-KEY>`).

## How it works

- `manifest.yml` declares the `jira:issuePanel` module (`render: native`, UI Kit)
  and a `jira:dashboardGadget` (with a UI Kit `edit` view to pick a project),
  plus a resolver function.
- `src/index.js` (resolver) proxies to the TestHub panel API with a bearer secret
  read from a Forge variable: `GET /api/v1/jira/coverage`, `GET/POST
  /api/v1/jira/tests`, `POST /api/v1/jira/link`, `POST /api/v1/jira/execute` and
  `GET /api/v1/jira/metrics`.
- `src/frontend/index.jsx` (UI Kit) renders the coverage summary, the linked
  tests with Pass/Fail buttons, an "Add tests" modal to search, link or create
  tests in TestHub, and the test **steps** (for mirrored/native Test issues).
- `src/frontend/gadget.jsx` / `gadget-edit.jsx` render the dashboard gadget and
  its configuration (defaults to the first mapped project when unconfigured).

## Configure

Set the panel base URL and the shared secret as Forge variables **for the
environment you deploy to** (the secret must match `JIRA_PANEL_SECRET` in
TestHub). Variables are per-environment — a deploy to `production` needs them set
for `production`, otherwise the panel shows
_"TESTHUB_PANEL_SECRET is not configured"_.

```bash
cd forge
npm install
forge login
forge register

# local/dev
forge variables set TESTHUB_BASE_URL https://testhub-one.vercel.app
forge variables set --encrypt TESTHUB_PANEL_SECRET <your-panel-secret>
forge deploy
forge install

# production
forge variables set --environment production TESTHUB_BASE_URL https://testhub-one.vercel.app
forge variables set --environment production --encrypt TESTHUB_PANEL_SECRET <your-panel-secret>
forge deploy -e production
forge install -e production
```

Variable changes only apply to **new** deployments, so always `forge deploy` after
setting them.

`forge install` asks which site/product to install into; choose your Jira site and
project. The app is installed site-wide; issue panels still need one deploy per
environment.

## Using the panel

`jira:issuePanel` does not show a panel automatically — it registers a **button**
on the issue. In the issue view, open the app actions button ("View app actions"
next to the issue summary icons, or the ••• menu) and choose **TestHub coverage**.
The panel then renders above the Activity feed with the coverage summary, the
linked tests, **Pass/Fail** record buttons, linked bugs and "Open in TestHub".

## Notes

- The outbound domain must be listed under `permissions.external.fetch.backend`
  in `manifest.yml` (the resolver fetches server-side).
- UI Kit (`render: native`) needs no bundler/Docker, so `forge deploy` works
  without a build step.

