import globals from 'globals';

import { baseConfig } from './base.mjs';

/**
 * Configuracion ESLint para librerias React del monorepo (packages/ui).
 *
 * @type {import('eslint').Linter.Config[]}
 */
export const reactLibraryConfig = [
  ...baseConfig,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  },
];

export default reactLibraryConfig;
