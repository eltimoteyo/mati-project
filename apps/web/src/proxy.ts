import { type NextRequest, NextResponse } from 'next/server';

/** Deben coincidir con los nombres que emite la API (`COOKIE_NAMES`). */
const ACCESS_COOKIE = 'conit_at';
const REFRESH_COOKIE = 'conit_rt';

/**
 * Indica si la API vive en otro origen distinto del de esta web.
 *
 * Cuando es asi (por ejemplo, web en `conit.novatec.ink` y API en
 * `api.conit.novatec.ink`), la cookie de sesion la emite el dominio de la API
 * y es *host-only*: el navegador la envia a la API, pero **no** a esta web. Es
 * decir, aqui nunca se ve, y la comprobacion de mas abajo daria siempre
 * "sin sesion", dejando `/admin` y `/portal` rebotando al login para siempre.
 *
 * La alternativa habitual es compartir la cookie con `Domain=.novatec.ink`,
 * pero eso la expone a **todos** los subdominios del dominio raiz, incluido lo
 * que haya en el apex. No compensa: esta guarda es solo cosmetica —lo dice el
 * comentario de abajo— y quien autoriza de verdad es la API en cada peticion,
 * con `AuthGuard` confirmandolo contra `/users/me` antes de pintar nada.
 */
function apiIsCrossOrigin(request: NextRequest): boolean {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  // Sin configurar, o con una ruta relativa, la API comparte origen.
  if (!apiUrl || apiUrl.startsWith('/')) return false;

  try {
    return new URL(apiUrl).host !== request.nextUrl.host;
  } catch {
    return false;
  }
}

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
 * redirigir un instante despues. Cuando no puede leer la cookie, se aparta y
 * deja pasar: `AuthGuard` resuelve el caso correctamente, solo que mostrando
 * un instante de "verificando tu sesion".
 */
export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (apiIsCrossOrigin(request)) {
    return NextResponse.next();
  }

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
