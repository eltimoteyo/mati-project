import type {
  CreatePortalMessageInput,
  CreatePortalTicketInput,
  PaginatedData,
  PortalProfile,
  PortalTicket,
  PortalTicketDetail,
  PortalTicketFilters,
} from '@conit/types';

import { apiClient } from '@/lib/api-client';
import { toQueryString } from '@/lib/query-string';

/**
 * Portal del cliente.
 *
 * Ninguna llamada envia un identificador de cliente: el ambito lo fija la
 * sesion en el servidor.
 */
export const portalService = {
  profile(): Promise<PortalProfile> {
    return apiClient.get<PortalProfile>('/portal/profile');
  },

  listTickets(filters: PortalTicketFilters = {}): Promise<PaginatedData<PortalTicket>> {
    return apiClient.get<PaginatedData<PortalTicket>>(`/portal/tickets${toQueryString(filters)}`);
  },

  getTicket(idOrCode: string): Promise<PortalTicketDetail> {
    return apiClient.get<PortalTicketDetail>(`/portal/tickets/${idOrCode}`);
  },

  createTicket(input: CreatePortalTicketInput): Promise<PortalTicketDetail> {
    return apiClient.post<PortalTicketDetail>('/portal/tickets', input);
  },

  addMessage(idOrCode: string, input: CreatePortalMessageInput): Promise<PortalTicketDetail> {
    return apiClient.post<PortalTicketDetail>(`/portal/tickets/${idOrCode}/messages`, input);
  },
};
