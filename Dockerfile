# TestHub production image (Postgres).
# Build:  docker build -t testhub .
# Run:    docker run -p 3000:3000 -e AUTH_SECRET=... \
#           -e DATABASE_URL=postgresql://... -e DIRECT_URL=postgresql://... testhub
FROM node:24-bookworm-slim

WORKDIR /app

# Dependencies. The schema is copied before install so the `postinstall`
# (`prisma generate`) step can run.
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma7.config.ts ./
RUN npm ci

# Application build.
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

RUN chmod +x ./docker-entrypoint.sh && chown -R node:node /app
USER node

EXPOSE 3000

# Apply migrations, then start.
CMD ["sh", "./docker-entrypoint.sh"]
