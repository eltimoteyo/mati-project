import { nextConfig } from '@conit/config/eslint/next';
// `eslint-config-next` exporta un array de configuraciones planas (no una
// funcion), por eso se expande en lugar de invocarse.
import next from 'eslint-config-next/core-web-vitals';

export default [{ ignores: ['.next/**', 'next-env.d.ts', 'public/**'] }, ...nextConfig, ...next];
