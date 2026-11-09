import type { ClientContact, ClientContactInput, SupportMetrics } from '@conit/types';

import { apiClient } from '@/lib/api-client';

export const supportService = {
  metrics: () => apiClient.get<SupportMetrics>('/support/metrics'),
  link: (id: string, clientId: string | null, verified: boolean) =>
    apiClient.patch(`/inbox/conversations/${id}/client`, { clientId, verified }),
  feedback: (conversationId: string, messageId: string, value: number, reason?: string) =>
    apiClient.post(`/inbox/conversations/${conversationId}/messages/${messageId}/feedback`, {
      value,
      reason,
    }),
  media: (conversationId: string, messageId: string) =>
    apiClient.getBlob(`/inbox/conversations/${conversationId}/messages/${messageId}/media`),
  contacts: (id: string) => apiClient.get<ClientContact[]>(`/clients/${id}/contacts`),
  saveContact: (id: string, input: ClientContactInput, contactId?: string) =>
    contactId
      ? apiClient.patch<ClientContact>(`/clients/${id}/contacts/${contactId}`, input)
      : apiClient.post<ClientContact>(`/clients/${id}/contacts`, input),
  deleteContact: (id: string, contactId: string) =>
    apiClient.delete(`/clients/${id}/contacts/${contactId}`),
  indexKnowledge: () => apiClient.post<{ indexed: number }>('/support/knowledge/index', {}),
};
