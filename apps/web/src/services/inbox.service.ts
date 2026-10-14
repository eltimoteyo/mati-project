import type {
  AiTicketDraft,
  CreateTicketInput,
  InboxAiPauseInput,
  InboxConversation,
  InboxConversationDetail,
  InboxMessage,
  InboxQuery,
  InboxReplyInput,
  PaginatedData,
  TicketDetail,
} from '@conit/types';

import { apiClient } from '@/lib/api-client';
import { toQueryString } from '@/lib/query-string';

/** Bandeja de WhatsApp. */
export const inboxService = {
  list(query: InboxQuery = {}): Promise<PaginatedData<InboxConversation>> {
    return apiClient.get<PaginatedData<InboxConversation>>(
      `/inbox/conversations${toQueryString(query)}`,
    );
  },

  get(id: string): Promise<InboxConversationDetail> {
    return apiClient.get<InboxConversationDetail>(`/inbox/conversations/${id}`);
  },

  markRead(id: string): Promise<null> {
    return apiClient.post<null>(`/inbox/conversations/${id}/read`, {});
  },

  setAiPaused(id: string, input: InboxAiPauseInput): Promise<InboxConversationDetail> {
    return apiClient.post<InboxConversationDetail>(`/inbox/conversations/${id}/ai`, input);
  },

  reply(id: string, input: InboxReplyInput): Promise<InboxMessage> {
    return apiClient.post<InboxMessage>(`/inbox/conversations/${id}/messages`, input);
  },

  createTicket(id: string, input: CreateTicketInput): Promise<TicketDetail> {
    return apiClient.post<TicketDetail>(`/inbox/conversations/${id}/tickets`, input);
  },

  /** Propuesta de la IA; no crea nada. */
  draftTicket(id: string): Promise<AiTicketDraft> {
    return apiClient.post<AiTicketDraft>(`/inbox/conversations/${id}/ticket-draft`, {});
  },
};
