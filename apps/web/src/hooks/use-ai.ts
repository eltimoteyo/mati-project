'use client';

import type { AiSuggestReplyInput } from '@conit/types';
import { useMutation, useQuery } from '@tanstack/react-query';

import { notify } from '@/lib/notify';
import { queryKeys } from '@/lib/query-keys';
import { aiService } from '@/services/ai.service';

/**
 * Disponibilidad del asistente.
 *
 * La interfaz oculta las acciones de IA cuando no hay proveedor configurado,
 * en lugar de mostrar botones que fallarian al pulsarlos. Se cachea largo: la
 * configuracion no cambia mientras el servidor esta en marcha.
 */
export function useAiStatus() {
  return useQuery({
    queryKey: queryKeys.ai.status(),
    queryFn: () => aiService.status(),
    staleTime: 30 * 60_000,
    retry: false,
  });
}

export function useSuggestReply() {
  return useMutation({
    mutationFn: ({ idOrCode, input }: { idOrCode: string; input: AiSuggestReplyInput }) =>
      aiService.suggestReply(idOrCode, input),
    onError: (error) => {
      notify.fromError(error, 'El asistente no pudo redactar la respuesta.');
    },
  });
}

export function useClassifyTicket() {
  return useMutation({
    mutationFn: (idOrCode: string) => aiService.classify(idOrCode),
    onError: (error) => {
      notify.fromError(error, 'El asistente no pudo clasificar el ticket.');
    },
  });
}

export function useSummarizeTicket() {
  return useMutation({
    mutationFn: (idOrCode: string) => aiService.summarize(idOrCode),
    onError: (error) => {
      notify.fromError(error, 'El asistente no pudo resumir el ticket.');
    },
  });
}
