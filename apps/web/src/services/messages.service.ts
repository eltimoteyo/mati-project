import type { CreateMessageInput, Message, UpdateMessageInput } from '@conit/types';

import { apiClient } from '@/lib/api-client';

/** Conversacion de un ticket. Las rutas cuelgan del ticket. */
export const messagesService = {
  list(idOrCode: string): Promise<Message[]> {
    return apiClient.get<Message[]>(`/tickets/${idOrCode}/messages`);
  },

  create(idOrCode: string, input: CreateMessageInput): Promise<Message> {
    return apiClient.post<Message>(`/tickets/${idOrCode}/messages`, input);
  },

  update(idOrCode: string, messageId: string, input: UpdateMessageInput): Promise<Message> {
    return apiClient.patch<Message>(`/tickets/${idOrCode}/messages/${messageId}`, input);
  },

  remove(idOrCode: string, messageId: string): Promise<null> {
    return apiClient.delete<null>(`/tickets/${idOrCode}/messages/${messageId}`);
  },
};
