# Security Policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, report them privately via GitHub's
[Report a vulnerability](../../security/advisories/new) feature (Security →
Advisories → Report a vulnerability), or email the maintainer listed on the
repository profile. Include:

- a description of the issue and its impact,
- steps to reproduce,
- affected version/commit, and
- any suggested fix.

You can expect an acknowledgement within a few days.

## Deployment hardening

When self-hosting or deploying TestHub, make sure you:

- set a strong, random `AUTH_SECRET` (the app refuses to start in production
  without one) and never commit it;
- set a strong `ENCRYPTION_KEY` and keep it identical across every environment
  that shares the database — Jira OAuth tokens and the SSO client secret are
  encrypted with it (AES-256-GCM). Rotating it requires re-encrypting or
  reconnecting;
- change the seeded admin password immediately, and never run `db:seed` in a
  way that leaves a default password in place;
- use a private Supabase Storage bucket and keep `SUPABASE_SERVICE_ROLE_KEY`
  server-side only;
- restrict database access (network rules) and use the pooled connection only
  for the app, with a direct connection for migrations;
- treat the Jira OAuth and SSO client secrets as sensitive — they are stored in
  the database, so encrypt them at rest or use a secret manager before
  exposing an instance to multiple tenants.

## Known limitations

- Attachments are served through an authenticated route that proxies the
  private storage bucket.
- Row-level secrets are encrypted at rest, but the `ENCRYPTION_KEY` must be
  protected like any other credential (a leaked key exposes stored tokens).
