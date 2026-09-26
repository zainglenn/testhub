#!/bin/sh
set -e

# Apply pending migrations, then start. Point DIRECT_URL at the direct Postgres
# connection (port 5432) so migrations don't run through the pooler.
echo "Applying database migrations (prisma migrate deploy)..."
npx prisma migrate deploy

exec npm run start
