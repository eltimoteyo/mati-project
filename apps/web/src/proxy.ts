import { type NextRequest, NextResponse } from 'next/server';

/** Deben coincidir con los nombres que emite la API (`COOKIE_NAMES`). */
const ACCESS_COOKIE = 'conit_at';
const REFRESH_COOKIE = 'conit_rt';

/**
 * Guarda de rutas del panel (convencion `proxy` de Next.js 16, antes
 * `middleware`).
 *
 * Es una comprobacion **optimista**: solo mira si existen las cookies de
 * sesion, sin verificar la firma del token. Hacerlo aqui exigiria exponer el
 * secreto JWT al frontend, y no aportaria seguridad real, porque la
 * autorizacion efectiva la aplica la API en cada peticion.
 *
 * Su valor es de experiencia de uso: evita renderizar el panel para
 * redirigir un instante despues.
 */
export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const hasSession = request.cookies.has(ACCESS_COOKIE) || request.cookies.has(REFRESH_COOKIE);

  if ((pathname.startsWith('/admin') || pathname.startsWith('/portal')) && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    // Se guarda el destino para volver a el tras iniciar sesion.
    url.searchParams.set('from', `${pathname}${search}`);

    return NextResponse.redirect(url);
  }

  // Para apartar al usuario del login se exige el refresh token, no el access
  // token: es el unico que puede sostener una sesion mas alla de 15 minutos.
  // Con la comprobacion laxa, una cookie de acceso caducada rebotaba entre
  // `/login` y `/admin` sin llegar a mostrar ninguna de las dos paginas.
  // No se puede decidir aqui si va al panel o al portal: el rol vive dentro
  // del token firmado y comprobarlo exigiria el secreto. Se manda al panel,
  // que redirige al portal cuando el usuario resulta ser un cliente.
  if (pathname === '/login' && request.cookies.has(REFRESH_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin';
    url.search = '';

    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/portal/:path*', '/login'],
};
