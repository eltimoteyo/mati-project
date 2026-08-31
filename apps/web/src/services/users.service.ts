import type { PublicUser } from '@conit/types';

import { apiClient } from '@/lib/api-client';

/** Operaciones sobre el dominio de usuarios. */
export const usersService = {
  /**
   * Perfil del usuario autenticado.
   * Es la fuente de verdad de la sesion: si responde 401, no hay sesion valida.
   */
  getProfile(): Promise<PublicUser> {
    return apiClient.get<PublicUser>('/users/me');
  },
};
