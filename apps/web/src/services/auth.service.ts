import type { LoginRequest, LoginResponse } from '@conit/types';

import { apiClient } from '@/lib/api-client';

/**
 * Operaciones de autenticacion contra la API.
 *
 * Los hooks de TanStack Query consumen estas funciones; los componentes no
 * conocen ni las rutas ni el formato de la API.
 */
export const authService = {
  /** Inicia sesion. La API responde con las cookies `httpOnly` de sesion. */
  login(credentials: LoginRequest): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>('/auth/login', credentials, {
      skipAuthRefresh: true,
    });
  },

  /** Cierra la sesion actual y revoca el refresh token en el servidor. */
  logout(): Promise<null> {
    return apiClient.post<null>('/auth/logout', undefined, { skipAuthRefresh: true });
  },
};
