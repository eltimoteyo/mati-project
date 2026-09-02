'use client';

import { type LoginRequest, type LoginResponse, USER_ROLES, type UserRole } from '@conit/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { siteConfig } from '@/config/site';
import { type ApiError } from '@/lib/api-error';
import { notify } from '@/lib/notify';
import { queryKeys } from '@/lib/query-keys';
import { authService } from '@/services/auth.service';

/** Destino por defecto segun el rol: el equipo al panel, el cliente al portal. */
export function homeForRole(role: UserRole): string {
  return role === USER_ROLES.CLIENT ? siteConfig.routes.portal : siteConfig.routes.dashboard;
}

/**
 * Acepta unicamente rutas internas, y solo las del area que corresponde al rol.
 *
 * Sin la primera comprobacion, un enlace del tipo `/login?from=https://otro-sitio`
 * convertiria el inicio de sesion en un redireccionamiento abierto. Sin la
 * segunda, un cliente acabaria en `/admin` para toparse con "Acceso
 * restringido", que parece un error del sistema y no lo es.
 */
export function sanitizeRedirect(target: string | undefined, role: UserRole): string {
  const fallback = homeForRole(role);

  if (!target || target.startsWith('//')) return fallback;

  const area = role === USER_ROLES.CLIENT ? '/portal' : '/admin';

  return target.startsWith(area) ? target : fallback;
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

  return useMutation<LoginResponse, ApiError, LoginRequest>({
    mutationFn: (credentials) => authService.login(credentials),

    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.auth.session(), response.user);

      notify.success('Inicio de sesion exitoso', {
        description: `Bienvenido nuevamente, ${response.user.name}.`,
      });

      // El destino se decide aqui y no al montar el formulario: hasta que no
      // responde la API no se sabe con que rol entra quien inicia sesion.
      router.replace(sanitizeRedirect(redirectTo, response.user.role));
      // Revalida los componentes de servidor para que el middleware vea la cookie.
      router.refresh();
    },

    onError: (error) => {
      notify.fromError(error, 'No pudimos iniciar sesion. Intentalo nuevamente.');
    },
  });
}
