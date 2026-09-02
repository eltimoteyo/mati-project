import type {
  AiClassification,
  AiStatus,
  AiSuggestion,
  AiSuggestReplyInput,
  AiSummary,
} from '@conit/types';

import { apiClient } from '@/lib/api-client';

/**
 * Asistente de soporte.
 *
 * Todos los endpoints proponen; ninguno escribe en el ticket. Lo que devuelven
 * llega a la interfaz para que el agente lo revise antes de usarlo.
 */
export const aiService = {
  status(): Promise<AiStatus> {
    return apiClient.get<AiStatus>('/ai/status');
  },

  suggestReply(idOrCode: string, input: AiSuggestReplyInput = {}): Promise<AiSuggestion> {
    return apiClient.post<AiSuggestion>(`/ai/tickets/${idOrCode}/reply`, input);
  },

  classify(idOrCode: string): Promise<AiClassification> {
    return apiClient.post<AiClassification>(`/ai/tickets/${idOrCode}/classify`, {});
  },

  summarize(idOrCode: string): Promise<AiSummary> {
    return apiClient.post<AiSummary>(`/ai/tickets/${idOrCode}/summary`, {});
  },
};
