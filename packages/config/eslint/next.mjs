import globals from 'globals';

import { baseConfig } from './base.mjs';

/**
 * Configuracion ESLint para la aplicacion Next.js.
 * `eslint-config-next` se carga desde la propia app para que pueda
 * resolver sus plugins internos con la version instalada alli.
 *
 * @type {import('eslint').Linter.Config[]}
 */
export const nextConfig = [
  ...baseConfig,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // En React los handlers async del cliente usan `console.error` controlado.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
];

export default nextConfig;
