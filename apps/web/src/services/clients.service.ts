import type {
  ClientRef,
  ClientWithCounts,
  CreateClientInput,
  PaginatedData,
  PaginationQuery,
  UpdateClientInput,
} from '@conit/types';

import { apiClient } from '@/lib/api-client';
import { toQueryString } from '@/lib/query-string';

export interface ClientListQuery extends PaginationQuery {
  status?: string;
}

/** Operaciones sobre el dominio de clientes. */
export const clientsService = {
  list(query: ClientListQuery = {}): Promise<PaginatedData<ClientWithCounts>> {
    return apiClient.get<PaginatedData<ClientWithCounts>>(`/clients${toQueryString(query)}`);
  },

  /** Lista ligera de clientes activos para los selectores de formulario. */
  options(): Promise<ClientRef[]> {
    return apiClient.get<ClientRef[]>('/clients/options');
  },

  get(id: string): Promise<ClientWithCounts> {
    return apiClient.get<ClientWithCounts>(`/clients/${id}`);
  },

  create(input: CreateClientInput): Promise<ClientWithCounts> {
    return apiClient.post<ClientWithCounts>('/clients', input);
  },

  update(id: string, input: UpdateClientInput): Promise<ClientWithCounts> {
    return apiClient.patch<ClientWithCounts>(`/clients/${id}`, input);
  },

  remove(id: string): Promise<null> {
    return apiClient.delete<null>(`/clients/${id}`);
  },
};
