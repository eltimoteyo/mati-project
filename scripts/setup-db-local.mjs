#!/usr/bin/env node
/**
 * Provisionamiento de la base de datos en un PostgreSQL local (sin Docker).
 *
 *   pnpm db:setup
 *
 * No ejecuta nada contra la base de datos: imprime el SQL exacto, ya relleno
 * con los datos de `apps/api/.env`, para que lo ejecutes como superusuario.
 *
 * Se hace asi a proposito: crear un rol exige credenciales de superusuario, y
 * esas no deben pasar por ningun script ni quedar en el historial de la shell.
 * El SQL se imprime en pantalla y nunca se escribe en el repositorio, porque
 * contiene la contrasena del rol de la aplicacion.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(rootDir, 'apps', 'api', '.env');

if (!existsSync(envPath)) {
  console.error('\n  No existe apps/api/.env. Ejecuta antes:  pnpm setup:env\n');
  process.exit(1);
}

const line = readFileSync(envPath, 'utf8')
  .split(/\r?\n/)
  .find((entry) => entry.startsWith('DATABASE_URL='));

if (!line) {
  console.error('\n  apps/api/.env no define DATABASE_URL.\n');
  process.exit(1);
}

let url;

try {
  url = new URL(line.slice('DATABASE_URL='.length).trim());
} catch {
  console.error('\n  DATABASE_URL no es una URL valida.\n');
  process.exit(1);
}

const role = decodeURIComponent(url.username);
const password = decodeURIComponent(url.password);
const database = url.pathname.replace(/^\//, '');
const host = url.hostname;
const port = url.port || '5432';

if (!role || !password || !database) {
  console.error('\n  DATABASE_URL debe incluir usuario, contrasena y nombre de base de datos.\n');
  process.exit(1);
}

/** Escapa comillas simples para incrustar el valor en un literal SQL. */
const sqlLiteral = (value) => `'${value.replace(/'/g, "''")}'`;

const sql = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${sqlLiteral(role)}) THEN
    CREATE ROLE ${role} LOGIN PASSWORD ${sqlLiteral(password)};
  ELSE
    ALTER ROLE ${role} LOGIN PASSWORD ${sqlLiteral(password)};
  END IF;
END
$$;

-- \`prisma migrate dev\` crea una "shadow database" temporal para calcular el
-- diff del esquema, asi que el rol necesita poder crear bases. Solo hace falta
-- en desarrollo: en produccion se usa \`prisma migrate deploy\`, que no la crea.
ALTER ROLE ${role} CREATEDB;

SELECT 'CREATE DATABASE ${database} OWNER ${role} ENCODING ''UTF8'''
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = ${sqlLiteral(database)})
\\gexec

\\connect ${database}
ALTER SCHEMA public OWNER TO ${role};
GRANT ALL ON SCHEMA public TO ${role};
`.trim();

console.log(`
==============================================================================
  CONIT SUPPORT — preparar PostgreSQL local
==============================================================================

  Destino:  ${host}:${port}
  Rol:      ${role}
  Base:     ${database}

  1) Abre una terminal y conectate como superusuario:

     psql -h ${host} -p ${port} -U postgres

  2) Pega este bloque (te pedira la contrasena de "postgres"):

------------------------------------------------------------------------------
${sql}
------------------------------------------------------------------------------

  3) Sal con \\q y vuelve aqui para aplicar migraciones y seed:

     pnpm db:migrate
     pnpm db:seed

==============================================================================
`);
