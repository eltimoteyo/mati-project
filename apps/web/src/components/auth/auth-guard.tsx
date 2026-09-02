'use client';

import { USER_ROLES, type UserRole } from '@conit/types';
import { ErrorState, PageLoader } from '@conit/ui';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';

import { siteConfig } from '@/config/site';
import { homeForRole } from '@/hooks/use-login';
import { useSession } from '@/hooks/use-session';
import { SESSION_EXPIRED_EVENT } from '@/lib/api-client';

interface AuthGuardProps {
  children: ReactNode;
  /** Rol que exige el area protegida. */
  role: UserRole;
}

/**
 * Guarda de sesion de las areas privadas.
 *
 * El middleware ya impide llegar aqui sin cookies, pero esa comprobacion es
 * optimista: solo mira que la cookie exista. Este componente confirma contra
 * la API que la sesion es real y que el rol es el correcto, y es el que decide
 * si el area llega a renderizarse.
 *
 * Cuando el rol no coincide **no se muestra "acceso denegado"**: se lleva al
 * usuario a su propia area. Un cliente que abre `/admin` no ha hecho nada
 * malo, normalmente viene de un enlace guardado, y un muro rojo le haria
 * pensar que su cuenta esta rota.
 */
export function AuthGuard({ children, role }: AuthGuardProps) {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, error, refetch } = useSession();

  const mismatched = Boolean(user) && user?.role !== role;

  // Sesion no recuperable (el refresco tambien fallo): de vuelta al login.
  useEffect(() => {
    const onSessionExpired = () => router.replace(siteConfig.routes.login);

    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);

    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
  }, [router]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !error) {
      router.replace(siteConfig.routes.login);
    }
  }, [isLoading, isAuthenticated, error, router]);

  useEffect(() => {
    if (mismatched && user) {
      router.replace(homeForRole(user.role));
    }
  }, [mismatched, user, router]);

  if (isLoading) {
    return <PageLoader fullscreen message="Verificando tu sesion…" />;
  }

  // Error distinto de 401: la API no responde. Se ofrece reintentar en lugar
  // de expulsar al usuario, que no tiene la culpa de una caida del servidor.
  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6">
        <ErrorState
          title="No pudimos verificar tu sesion"
          description="El servidor de CONIT Support no responde en este momento."
          onRetry={refetch}
        />
      </div>
    );
  }

  if (!isAuthenticated || !user || mismatched) {
    return <PageLoader fullscreen message="Redirigiendo…" />;
  }

  return <>{children}</>;
}

/** Atajos para no repetir el rol en cada layout. */
export function AdminGuard({ children }: { children: ReactNode }) {
  return <AuthGuard role={USER_ROLES.ADMIN}>{children}</AuthGuard>;
}

export function PortalGuard({ children }: { children: ReactNode }) {
  return <AuthGuard role={USER_ROLES.CLIENT}>{children}</AuthGuard>;
}
