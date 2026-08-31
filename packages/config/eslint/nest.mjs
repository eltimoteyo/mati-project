import globals from 'globals';

import { baseConfig } from './base.mjs';

/**
 * Configuracion ESLint para aplicaciones NestJS.
 * Los decoradores de Nest requieren excepciones puntuales.
 *
 * @type {import('eslint').Linter.Config[]}
 */
export const nestConfig = [
  ...baseConfig,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      parserOptions: {
        sourceType: 'commonjs',
      },
    },
    rules: {
      /*
       * DESACTIVADA A PROPOSITO.
       *
       * NestJS resuelve la inyeccion de dependencias leyendo los tipos de los
       * parametros del constructor en tiempo de ejecucion, via
       * `emitDecoratorMetadata`. Convertir esos imports en `import type` los
       * borra del JavaScript emitido y la inyeccion falla al arrancar con un
       * error del tipo "Nest can't resolve dependencies".
       *
       * La regla no puede distinguir esos casos sin analisis de tipos, y su
       * autofix romperia la aplicacion, de modo que se apaga en toda la API.
       */
      '@typescript-eslint/consistent-type-imports': 'off',

      // Los decoradores de NestJS usan clases vacias como DTO base.
      '@typescript-eslint/no-extraneous-class': 'off',
      // `interface` vacia es habitual en modulos declarativos de Nest.
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', '**/prisma/seed.ts'],
    rules: {
      'no-console': 'off',
    },
  },
];

export default nestConfig;
