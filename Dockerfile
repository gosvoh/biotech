FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --force

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG DATABASE_URL
ENV DATABASE_URL ${DATABASE_URL}

RUN npm run db:deploy
RUN npm run db:generate
RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

RUN mkdir .next
RUN chown nextjs:nodejs .next

RUN mkdir uploads
RUN chown -R nextjs:nodejs uploads

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/database ./database
COPY --from=builder --chown=nextjs:nodejs /app/migrations ./migrations
COPY --from=builder --chown=nextjs:nodejs /app/schema.prisma ./schema.prisma

USER nextjs

EXPOSE 3000

ENV PORT 3000

VOLUME /app/database
VOLUME /app/uploads

ARG DATABASE_URL
ENV DATABASE_URL ${DATABASE_URL}
RUN npx --yes prisma migrate deploy

CMD HOSTNAME="0.0.0.0" node server.js