import type { PaginatedData, PublicUser, UserRole, UserStatus } from '@conit/types';

import { apiClient } from '@/lib/api-client';
import { toQueryString } from '@/lib/query-string';

export interface UserListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: UserRole;
  status?: UserStatus;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  status?: UserStatus;
}

export interface UpdateUserInput {
  name?: string;
  role?: UserRole;
  status?: UserStatus;
}

/** Operaciones sobre el dominio de usuarios. */
export const usersService = {
  /**
   * Perfil del usuario autenticado.
   * Es la fuente de verdad de la sesion: si responde 401, no hay sesion valida.
   */
  getProfile(): Promise<PublicUser> {
    return apiClient.get<PublicUser>('/users/me');
  },

  list(query: UserListQuery = {}): Promise<PaginatedData<PublicUser>> {
    return apiClient.get<PaginatedData<PublicUser>>(`/users${toQueryString(query)}`);
  },

  create(input: CreateUserInput): Promise<PublicUser> {
    return apiClient.post<PublicUser>('/users', input);
  },

  update(id: string, input: UpdateUserInput): Promise<PublicUser> {
    return apiClient.patch<PublicUser>(`/users/${id}`, input);
  },

  /** Fija una contrasena nueva. Cierra las sesiones abiertas del titular. */
  resetPassword(id: string, password: string): Promise<null> {
    return apiClient.post<null>(`/users/${id}/password`, { password });
  },
};
