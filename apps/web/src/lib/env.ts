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

/**
 * Origen de la API, sin el prefijo de version.
 *
 * Los ficheros subidos (fotos de perfil) los sirve la API en `/uploads/...`,
 * fuera del prefijo `/api/v1`. Sin recortarlo, la imagen se pediria a una ruta
 * que no existe.
 */
export const apiOrigin = env.apiUrl.replace(/\/api\/v\d+\/?$/, '');

/**
 * URL completa de una foto de perfil.
 *
 * Acepta tambien URLs absolutas por si algun dia las imagenes se alojan fuera:
 * en ese caso se devuelven tal cual.
 */
export function resolveAvatarUrl(avatar: string | null | undefined): string | undefined {
  if (!avatar) return undefined;
  if (/^https?:\/\//i.test(avatar)) return avatar;

  return `${apiOrigin}${avatar}`;
}
