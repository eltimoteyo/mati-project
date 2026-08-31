#!/usr/bin/env node
/**
 * Prepara los archivos de entorno locales a partir de los `.env.example`.
 *
 *   pnpm setup:env
 *
 * - Nunca sobrescribe un archivo existente.
 * - Genera secretos JWT aleatorios en lugar de copiar los marcadores del
 *   ejemplo, para que un entorno recien clonado no arranque con secretos
 *   conocidos por cualquiera que lea el repositorio.
 */

import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Archivos a preparar: [origen, destino, ¿generar secretos?] */
const TARGETS = [
  ['.env.example', '.env', true],
  ['apps/api/.env.example', 'apps/api/.env', true],
  ['apps/web/.env.example', 'apps/web/.env.local', false],
];

const secret = () => randomBytes(48).toString('base64');

/** Sustituye los marcadores de secreto por valores aleatorios reales. */
function withGeneratedSecrets(content) {
  return content
    .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret()}`)
    .replace(/^JWT_REFRESH_SECRET=.*$/m, `JWT_REFRESH_SECRET=${secret()}`);
}

let created = 0;

for (const [source, destination, generateSecrets] of TARGETS) {
  const sourcePath = join(rootDir, source);
  const destinationPath = join(rootDir, destination);

  if (!existsSync(sourcePath)) {
    console.warn(`  omitido  ${source} (no existe)`);
    continue;
  }

  if (existsSync(destinationPath)) {
    console.log(`  existe   ${relative(rootDir, destinationPath)}`);
    continue;
  }

  if (generateSecrets) {
    writeFileSync(destinationPath, withGeneratedSecrets(readFileSync(sourcePath, 'utf8')), 'utf8');
  } else {
    copyFileSync(sourcePath, destinationPath);
  }

  console.log(`  creado   ${relative(rootDir, destinationPath)}`);
  created += 1;
}

console.log('');

if (created > 0) {
  console.log('  Archivos de entorno listos. Antes de continuar, define:');
  console.log('    - POSTGRES_PASSWORD y DATABASE_URL  (misma contrasena en ambos)');
  console.log('    - ADMIN_PASSWORD en apps/api/.env   (necesario para el seed)');
} else {
  console.log('  Nada que hacer: los archivos de entorno ya existian.');
}

console.log('');
