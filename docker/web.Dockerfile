# =============================================================================
# CONIT SUPPORT — Imagen del panel (Next.js 16)
# -----------------------------------------------------------------------------
# Construccion multietapa desde la RAIZ del monorepo:
#
#   docker build -f docker/web.Dockerfile -t conit-web .
#
# IMPORTANTE: las variables `NEXT_PUBLIC_*` se incrustan en el bundle durante
# la compilacion, por eso se reciben como `ARG` y no como variables de entorno
# en tiempo de ejecucion.
# =============================================================================

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    CI=true
RUN corepack enable
WORKDIR /app

# -----------------------------------------------------------------------------
# 1) Dependencias
# -----------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/validation/package.json ./packages/validation/
COPY packages/ui/package.json ./packages/ui/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# 2) Compilacion
# -----------------------------------------------------------------------------
FROM deps AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
ARG NEXT_PUBLIC_APP_NAME="CONIT Support"
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_TELEMETRY_DISABLED=1 \
    DOCKER_BUILD=true \
    NODE_ENV=production

COPY . .
RUN pnpm --filter @conit/types --filter @conit/validation run build
RUN pnpm --filter @conit/web run build

# -----------------------------------------------------------------------------
# 3) Ejecucion — salida `standalone`, sin `node_modules` completos
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# `outputFileTracingRoot` apunta a la raiz del monorepo, de modo que la salida
# standalone reproduce la estructura `apps/web/server.js`.
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
