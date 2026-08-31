import { redirect } from 'next/navigation';

import { siteConfig } from '@/config/site';

/**
 * Punto de entrada.
 *
 * Siempre lleva al panel; si no hay sesion, el middleware desvia a `/login`.
 * Asi la decision de acceso vive en un unico sitio.
 */
export default function HomePage() {
  redirect(siteConfig.routes.dashboard);
}
