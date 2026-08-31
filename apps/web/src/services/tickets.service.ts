import type {
  CreateTicketInput,
  PaginatedData,
  Ticket,
  TicketDetail,
  TicketQuery,
  UpdateTicketInput,
} from '@conit/types';

import { apiClient } from '@/lib/api-client';
import { toQueryString } from '@/lib/query-string';

/** Operaciones sobre incidencias. */
export const ticketsService = {
  list(query: TicketQuery = {}): Promise<PaginatedData<Ticket>> {
    return apiClient.get<PaginatedData<Ticket>>(`/tickets${toQueryString(query)}`);
  },

  /** Acepta el UUID o el codigo visible (`CNT-0042`). */
  get(idOrCode: string): Promise<TicketDetail> {
    return apiClient.get<TicketDetail>(`/tickets/${idOrCode}`);
  },

  create(input: CreateTicketInput): Promise<TicketDetail> {
    return apiClient.post<TicketDetail>('/tickets', input);
  },

  update(idOrCode: string, input: UpdateTicketInput): Promise<TicketDetail> {
    return apiClient.patch<TicketDetail>(`/tickets/${idOrCode}`, input);
  },

  remove(idOrCode: string): Promise<null> {
    return apiClient.delete<null>(`/tickets/${idOrCode}`);
  },
};
