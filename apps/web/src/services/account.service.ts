import type { PublicUser } from '@conit/types';

import { apiClient } from '@/lib/api-client';

/** Operaciones sobre la cuenta del propio usuario. */
export const accountService = {
  updateProfile(name: string): Promise<PublicUser> {
    return apiClient.patch<PublicUser>('/users/me', { name });
  },

  /**
   * Cambia la contrasena. `skipAuthRefresh` evita que un 401 por contrasena
   * actual incorrecta se confunda con una sesion caducada y dispare un
   * refresco innecesario.
   */
  changePassword(currentPassword: string, newPassword: string): Promise<null> {
    return apiClient.post<null>(
      '/auth/change-password',
      { currentPassword, newPassword },
      { skipAuthRefresh: true },
    );
  },
};
