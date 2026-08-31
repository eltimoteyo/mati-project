/**
 * Acceso centralizado a la configuracion publica.
 *
 * Next reemplaza las variables `NEXT_PUBLIC_*` en tiempo de compilacion, por
 * lo que deben referenciarse de forma estatica (nunca `process.env[clave]`).
 * Concentrarlas aqui evita que se repartan por los componentes.
 */
export const env = {
  /** URL de la API tal como la ve el navegador, con prefijo incluido. */
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1',
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'CONIT Support',
  isProduction: process.env.NODE_ENV === 'production',
} as const;
