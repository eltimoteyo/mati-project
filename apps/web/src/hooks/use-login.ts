'use client';

import type { LoginRequest, LoginResponse } from '@conit/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { siteConfig } from '@/config/site';
import { type ApiError } from '@/lib/api-error';
import { notify } from '@/lib/notify';
import { queryKeys } from '@/lib/query-keys';
import { authService } from '@/services/auth.service';

/**
 * Acepta unicamente rutas internas del panel.
 *
 * Sin esta comprobacion, un enlace del tipo `/login?from=https://otro-sitio`
 * convertiria el inicio de sesion en un redireccionamiento abierto.
 */
export function sanitizeRedirect(target: string | undefined): string {
  if (!target) return siteConfig.routes.dashboard;

  const isInternalAdminPath = target.startsWith('/admin') && !target.startsWith('//');

  return isInternalAdminPath ? target : siteConfig.routes.dashboard;
}

/**
 * Inicio de sesion.
 *
 * Al completarse siembra la cache con el usuario devuelto para que el panel
 * se pinte de inmediato, sin un `GET /users/me` adicional ni parpadeo de
 * estado de carga.
 */
export function useLogin(redirectTo?: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const destination = sanitizeRedirect(redirectTo);

  return useMutation<LoginResponse, ApiError, LoginRequest>({
    mutationFn: (credentials) => authService.login(credentials),

    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.auth.session(), response.user);

      notify.success('Inicio de sesion exitoso', {
        description: `Bienvenido nuevamente, ${response.user.name}.`,
      });

      router.replace(destination);
      // Revalida los componentes de servidor para que el middleware vea la cookie.
      router.refresh();
    },

    onError: (error) => {
      notify.fromError(error, 'No pudimos iniciar sesion. Intentalo nuevamente.');
    },
  });
}
