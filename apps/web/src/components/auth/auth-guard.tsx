'use client';

import { Button, ErrorState, PageLoader } from '@conit/ui';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';

import { siteConfig } from '@/config/site';
import { useLogout } from '@/hooks/use-logout';
import { useSession } from '@/hooks/use-session';
import { SESSION_EXPIRED_EVENT } from '@/lib/api-client';

/**
 * Guarda de sesion del panel.
 *
 * El middleware ya impide llegar aqui sin cookies, pero esa comprobacion es
 * optimista: solo mira que la cookie exista. Este componente confirma contra
 * la API que la sesion es real y que el rol es el correcto, y es el que decide
 * si el panel llega a renderizarse.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, isAdmin, error, refetch } = useSession();
  const logout = useLogout();

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

  if (!isAuthenticated || !user) {
    return <PageLoader fullscreen message="Redirigiendo…" />;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold">Acceso restringido</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            Tu cuenta no tiene permisos para entrar al panel administrativo.
          </p>
        </div>
        <Button variant="outline" loading={logout.isPending} onClick={() => logout.mutate()}>
          Cerrar sesion
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
