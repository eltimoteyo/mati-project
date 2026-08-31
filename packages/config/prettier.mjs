/**
 * Configuracion Prettier compartida.
 * La raiz del monorepo usa `.prettierrc.json`; este modulo permite
 * que cualquier paquete reutilice exactamente las mismas reglas.
 *
 * @type {import('prettier').Config}
 */
export const prettierConfig = {
  semi: true,
  singleQuote: true,
  jsxSingleQuote: false,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  arrowParens: 'always',
  endOfLine: 'lf',
  bracketSpacing: true,
};

export default prettierConfig;
