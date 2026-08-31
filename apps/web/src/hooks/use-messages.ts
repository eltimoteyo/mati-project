'use client';

import type { CreateMessageInput, UpdateMessageInput } from '@conit/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { notify } from '@/lib/notify';
import { queryKeys } from '@/lib/query-keys';
import { messagesService } from '@/services/messages.service';

/**
 * Tras enviar, editar o borrar un mensaje se invalida el ticket entero, no solo
 * la lista de mensajes: el detalle trae la conversacion embebida y el primer
 * mensaje publico puede cambiar la marca de primera respuesta.
 */
function useConversationInvalidation(idOrCode: string) {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.tickets.detail(idOrCode) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all });
  };
}

export function useSendMessage(idOrCode: string) {
  const invalidate = useConversationInvalidation(idOrCode);

  return useMutation({
    mutationFn: (input: CreateMessageInput) => messagesService.create(idOrCode, input),
    onSuccess: (message) => {
      invalidate();
      notify.success(
        message.visibility === 'PUBLIC' ? 'Respuesta enviada' : 'Nota interna guardada',
      );
    },
    onError: (error) => notify.fromError(error, 'No se pudo enviar el mensaje.'),
  });
}

export function useUpdateMessage(idOrCode: string) {
  const invalidate = useConversationInvalidation(idOrCode);

  return useMutation({
    mutationFn: ({ messageId, input }: { messageId: string; input: UpdateMessageInput }) =>
      messagesService.update(idOrCode, messageId, input),
    onSuccess: () => {
      invalidate();
      notify.success('Mensaje actualizado');
    },
    onError: (error) => notify.fromError(error, 'No se pudo editar el mensaje.'),
  });
}

export function useDeleteMessage(idOrCode: string) {
  const invalidate = useConversationInvalidation(idOrCode);

  return useMutation({
    mutationFn: (messageId: string) => messagesService.remove(idOrCode, messageId),
    onSuccess: () => {
      invalidate();
      notify.success('Mensaje eliminado');
    },
    onError: (error) => notify.fromError(error, 'No se pudo eliminar el mensaje.'),
  });
}
