import 'dotenv/config';

import { defineConfig } from 'prisma/config';

/**
 * Configuracion del CLI de Prisma (v7).
 *
 * Desde Prisma 7 la cadena de conexion ya no vive en `schema.prisma` y el CLI
 * no carga `.env` automaticamente: de ahi el `import 'dotenv/config'` inicial,
 * que lee `apps/api/.env`.
 *
 * Esta configuracion solo afecta a los comandos del CLI (migrate, db, studio,
 * seed). En tiempo de ejecucion, la aplicacion abre la conexion mediante el
 * adaptador `PrismaPg` que construye `PrismaService`.
 */

/**
 * La URL se resuelve de forma tolerante en lugar de con el helper `env()`.
 *
 * `env('DATABASE_URL')` aborta la carga del archivo si la variable no existe,
 * y eso rompe `prisma generate` durante la construccion de la imagen Docker,
 * donde deliberadamente no hay `.env` (los secretos no deben entrar en la
 * imagen). `generate` no necesita conexion; solo migrate, studio y seed la
 * usan, y esos comandos avisan por su cuenta si falta el `datasource`.
 */
const databaseUrl = process.env['DATABASE_URL'];

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    /*
     * `--skipProject` es intencional: sin el, ts-node lee `tsconfig.json`, que
     * hereda de `@conit/config`. Ese paquete es una devDependency y no existe
     * en la imagen de produccion (`pnpm deploy --prod`), asi que el seed
     * fallaria dentro del contenedor con "File '@conit/config/...' not found".
     * Las opciones que el seed necesita se pasan aqui de forma explicita.
     */
    seed:
      'ts-node --skipProject --compiler-options ' +
      '{"module":"CommonJS","moduleResolution":"Node","target":"ES2022",' +
      '"esModuleInterop":true,"skipLibCheck":true,"strict":true} ' +
      'prisma/seed.ts',
  },
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});
