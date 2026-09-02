# Railway detects the root Dockerfile for this monorepo.
# The API-specific Dockerfile under docker/ remains the canonical local target.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    CI=true
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/validation/package.json ./packages/validation/
COPY packages/ui/package.json ./packages/ui/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @conit/types --filter @conit/validation run build
RUN pnpm --filter @conit/api run build
RUN pnpm deploy --legacy --prod --filter=@conit/api /prod/api
RUN test -f /prod/api/scripts/seed-production.cjs

FROM base AS runner
ENV NODE_ENV=production \
    PORT=4000 \
    PATH="/app/node_modules/.bin:/pnpm:$PATH"
COPY --from=build --chown=node:node /prod/api /app
WORKDIR /app
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "prisma migrate deploy && node scripts/seed-production.cjs && exec node dist/main.js"]
