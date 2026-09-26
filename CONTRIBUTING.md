# Contributing

Thanks for your interest in TestHub. This project is open source and
contributions are welcome — issues, docs, and pull requests.

## Development setup

1. **Prerequisites**: Node.js 20.9+ and a PostgreSQL database. A free
   [Supabase](https://supabase.com) project works, or run Postgres locally with
   `docker compose up db`.
2. **Install and configure**:
   ```bash
   npm install
   cp .env.example .env     # Windows: copy .env.example .env
   ```
   Fill `DATABASE_URL` and `DIRECT_URL` in `.env` (see the README **Deploy**
   section for the Supabase values). `AUTH_SECRET` is required in production.
3. **Database**:
   ```bash
   npm run db:migrate       # apply migrations (uses DIRECT_URL)
   npm run db:seed          # create an admin user + default workspace
   npm run db:seed:scrum    # optional: a demo workspace linked to Jira
   npm run dev
   ```

## Before you open a PR

Run the full check suite and make sure it is green:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

- Keep changes focused; one topic per pull request.
- Match the existing code style (TypeScript, MUI, server actions in
  `src/lib/actions`, validation schemas in `src/lib/validation.ts`).
- Add or update tests for behaviour changes (`vitest`).
- If you change the Prisma schema, add a migration
  (`npx prisma migrate dev --name <change>`) and include it in the PR.
- Do not commit secrets. `.env` is gitignored; use `.env.example` for new
  variables (with placeholder values).

## Reporting bugs and security issues

- Bugs and feature requests: open a GitHub issue.
- Security vulnerabilities: see [SECURITY.md](./SECURITY.md) — please do not
  open a public issue for those.

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](./LICENSE).
