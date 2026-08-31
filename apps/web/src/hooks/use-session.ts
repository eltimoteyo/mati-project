'use client';

import { type PublicUser, USER_ROLES } from '@conit/types';
import { useQuery } from '@tanstack/react-query';

import { ApiError } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-keys';
import { usersService } from '@/services/users.service';

export interface SessionState {
  user: PublicUser | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  /** Error distinto de "no autenticado" (por ejemplo, API caida). */
  error: ApiError | null;
  refetch: () => void;
}

/**
 * Sesion activa del usuario.
 *
 * Consulta `GET /users/me`, que el cliente HTTP protege con refresco
 * automatico: si el access token caduco pero el refresh token sigue vigente,
 * la sesion se renueva sin que el usuario lo perciba.
 */
export function useSession(): SessionState {
  const query = useQuery({
    queryKey: queryKeys.auth.session(),
    queryFn: () => usersService.getProfile(),
    // La sesion es informacion sensible al tiempo: se revalida al reenfocar.
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    retry: false,
  });

  const error = query.error instanceof ApiError ? query.error : null;

  return {
    user: query.data,
    isLoading: query.isPending,
    isAuthenticated: Boolean(query.data),
    isAdmin: query.data?.role === USER_ROLES.ADMIN,
    // Un 401 no es un error a mostrar: significa "aun no has iniciado sesion".
    error: error?.isUnauthorized ? null : error,
    refetch: () => void query.refetch(),
  };
}
