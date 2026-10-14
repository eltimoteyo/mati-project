'use client';

import type { CreateTicketInput, InboxQuery, InboxReplyInput } from '@conit/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notify } from '@/lib/notify';
import { queryKeys } from '@/lib/query-keys';
import { inboxService } from '@/services/inbox.service';

/**
 * Cada cuanto se refresca la bandeja mientras esta abierta.
 *
 * Mucho mas a menudo que la campana de avisos: un chat en el que la
 * respuesta del cliente tarda un minuto en aparecer no sirve para conversar.
 * Solo se consulta con la pantalla abierta, asi que el coste queda acotado.
 */
const LIST_REFETCH_MS = 10_000;
const DETAIL_REFETCH_MS = 5_000;

export function useInboxConversations(query: InboxQuery) {
  return useQuery({
    queryKey: queryKeys.inbox.list(query),
    queryFn: () => inboxService.list(query),
    placeholderData: (previous) => previous,
    refetchInterval: LIST_REFETCH_MS,
  });
}

export function useInboxConversation(id: string | null) {
  return useQuery({
    queryKey: queryKeys.inbox.detail(id ?? ''),
    queryFn: () => inboxService.get(id ?? ''),
    enabled: Boolean(id),
    refetchInterval: DETAIL_REFETCH_MS,
  });
}

export function useMarkInboxRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => inboxService.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.inbox.all });
    },
  });
}

export function useSendInboxReply(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: InboxReplyInput) => inboxService.reply(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.inbox.all });
    },
    onError: (error) => notify.fromError(error, 'No se pudo enviar el mensaje.'),
  });
}

export function useSetInboxAiPaused(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (paused: boolean) => inboxService.setAiPaused(id, { paused }),
    onSuccess: (conversation) => {
      queryClient.setQueryData(queryKeys.inbox.detail(id), conversation);
      void queryClient.invalidateQueries({ queryKey: queryKeys.inbox.all });
      notify.success(
        conversation.aiPaused ? 'IA en pausa en esta conversacion' : 'IA reanudada en esta conversacion',
      );
    },
    onError: (error) => notify.fromError(error, 'No se pudo cambiar la respuesta automatica.'),
  });
}

export function useCreateInboxTicket(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTicketInput) => inboxService.createTicket(id, input),
    onSuccess: (ticket) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.inbox.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      notify.success(`Ticket ${ticket.code} creado`, { description: ticket.subject });
    },
  });
}

export function useDraftInboxTicket(id: string) {
  return useMutation({
    mutationFn: () => inboxService.draftTicket(id),
    onError: (error) => notify.fromError(error, 'El asistente no pudo proponer el ticket.'),
  });
}
