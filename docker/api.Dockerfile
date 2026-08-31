# =============================================================================
# CONIT SUPPORT — Imagen de la API (NestJS + Prisma)
# -----------------------------------------------------------------------------
# Construccion multietapa desde la RAIZ del monorepo:
#
#   docker build -f docker/api.Dockerfile -t conit-api .
#
# Se usa Debian slim en lugar de Alpine porque el adaptador `pg` y los binarios
# nativos de Argon2 son mas predecibles con glibc.
# =============================================================================

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    CI=true
# Prisma necesita OpenSSL para elegir el binario de motor correcto; la imagen
# `slim` no lo incluye y sin el emite avisos y puede escoger uno equivocado.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

# -----------------------------------------------------------------------------
# 1) Dependencias — capa cacheable: solo se invalida si cambian los manifiestos
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
# 2) Compilacion y extraccion
# -----------------------------------------------------------------------------
FROM deps AS build
COPY . .

# Los paquetes compartidos se compilan antes: la API los consume desde `dist`.
RUN pnpm --filter @conit/types --filter @conit/validation run build

# `build` de la API ejecuta `prisma generate` antes de `nest build`.
RUN pnpm --filter @conit/api run build

# `pnpm deploy` extrae la API con SOLO su arbol de dependencias, resolviendo
# los paquetes `workspace:*` a copias reales. Sin este paso habria que copiar
# el workspace completo y la imagen arrastraria todas las dependencias del
# panel (Next, React, Tailwind...), multiplicando su tamano por cinco.
#
# `--prod` descarta las herramientas de construccion (@nestjs/cli, tipos,
# eslint). Lo que el contenedor si necesita en ejecucion —el CLI de Prisma para
# `migrate deploy`, y ts-node para el seed— esta declarado como dependencia de
# produccion en apps/api/package.json, no como devDependency.
RUN pnpm deploy --legacy --prod --filter=@conit/api /prod/api

# -----------------------------------------------------------------------------
# 3) Ejecucion
# -----------------------------------------------------------------------------
FROM base AS runner
# Los binarios locales (`prisma`, `ts-node`) entran en el PATH para poder
# invocarlos por nombre, tanto al arrancar como desde `docker compose exec`.
# Sin esto el seed falla con `spawn ts-node ENOENT`.
ENV NODE_ENV=production \
    PORT=4000 \
    PATH="/app/node_modules/.bin:/pnpm:$PATH"

COPY --from=build --chown=node:node /prod/api /app

WORKDIR /app
USER node

EXPOSE 4000

# Comprobacion de vitalidad alineada con el endpoint publico `/health`.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Aplica las migraciones pendientes y arranca.
#
# Se invocan los binarios directamente en lugar de `pnpm run`: asi el arranque
# no depende de corepack ni de ninguna verificacion del gestor de paquetes.
#
# En despliegues con varias replicas, ejecuta `prisma migrate deploy` como paso
# previo del pipeline y deja aqui solo `node dist/main.js`.
CMD ["sh", "-c", "prisma migrate deploy && exec node dist/main.js"]
