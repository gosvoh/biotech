FROM oven/bun:1 AS base

WORKDIR /app

FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --no-save --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

RUN bun run db:deploy
RUN bun run db:generate
RUN bun run build

# Self-contained Prisma CLI with engines for runtime `migrate deploy`.
# Keep the version in sync with @prisma/client in package.json.
# Running `migrate deploy` here forces the schema-engine binary to be fetched
# at build time so the runner never needs network access on startup.
FROM base AS prisma-cli
WORKDIR /prisma-cli
RUN bun add prisma@6.19.3
COPY schema.prisma ./schema.prisma
COPY migrations ./migrations
# Invoke via `bun` explicitly: the oven/bun image has no `node`, so the
# `#!/usr/bin/env node` shebang in the prisma bin would fail.
RUN DATABASE_URL="file:/tmp/build.db" bun ./node_modules/prisma/build/index.js migrate deploy --schema=./schema.prisma

FROM base AS runner
WORKDIR /app


ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --no-log-init -g nodejs nextjs

RUN mkdir uploads
RUN chown -R nextjs:nodejs uploads

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/database ./database
COPY --from=builder --chown=nextjs:nodejs /app/migrations ./migrations
COPY --from=builder --chown=nextjs:nodejs /app/schema.prisma ./schema.prisma
COPY --from=prisma-cli --chown=nextjs:nodejs /prisma-cli/node_modules ./prisma-cli/node_modules
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

VOLUME /app/database
VOLUME /app/uploads

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["bun", "./server.js"]
