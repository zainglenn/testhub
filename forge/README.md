# TestHub for Jira (Forge issue panel)

A [Forge](https://developer.atlassian.com/platform/forge/) app that adds a
**TestHub coverage** panel to Jira issue pages, showing the tests linked to the
issue, their latest results and linked bugs. It calls the TestHub coverage API
(`/api/v1/jira/coverage?key=<ISSUE-KEY>`).

## How it works

- `manifest.yml` declares the `jira:issuePanel` module (`render: native`, UI Kit)
  and a resolver function.
- `src/index.js` (resolver) calls the coverage API with a bearer secret read
  from a Forge variable and returns the JSON to the panel.
- `src/frontend/index.jsx` (UI Kit) renders the coverage summary and tests.

## Configure

Set the panel base URL and the shared secret as Forge variables (the secret must
match `JIRA_PANEL_SECRET` in TestHub):

```bash
cd forge
npm install
forge login
forge register
forge variables set TESTHUB_BASE_URL https://testhub-one.vercel.app
forge variables set --encrypt TESTHUB_PANEL_SECRET <your-panel-secret>
forge deploy
forge install
```

`forge install` asks which site/product to install into; choose your Jira site
and select the `SCRUM` project (or all). Then open any issue — the app button
appears in the issue's apps section.

## Notes

- The outbound domain must be listed under `permissions.external.fetch.client`
  in `manifest.yml`.
- UI Kit (`render: native`) needs no bundler/Docker, so `forge deploy` works
  without a build step.
