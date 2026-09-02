'use client';

import type {
  CreatePortalMessageInput,
  CreatePortalTicketInput,
  PortalTicketFilters,
} from '@conit/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notify } from '@/lib/notify';
import { queryKeys } from '@/lib/query-keys';
import { portalService } from '@/services/portal.service';

export function usePortalProfile() {
  return useQuery({
    queryKey: queryKeys.portal.profile(),
    queryFn: () => portalService.profile(),
  });
}

export function usePortalTickets(filters: PortalTicketFilters) {
  return useQuery({
    queryKey: queryKeys.portal.tickets(filters),
    queryFn: () => portalService.listTickets(filters),
    placeholderData: (previous) => previous,
  });
}

export function usePortalTicket(idOrCode: string) {
  return useQuery({
    queryKey: queryKeys.portal.ticket(idOrCode),
    queryFn: () => portalService.getTicket(idOrCode),
    enabled: Boolean(idOrCode),
  });
}

export function useCreatePortalTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePortalTicketInput) => portalService.createTicket(input),
    onSuccess: (ticket) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.portal.all });
      notify.success(`Incidencia ${ticket.code} registrada`, {
        description: 'Te avisaremos por correo en cuanto la revisemos.',
      });
    },
    onError: (error) => {
      notify.fromError(error, 'No pudimos registrar la incidencia.');
    },
  });
}

export function useAddPortalMessage(idOrCode: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePortalMessageInput) => portalService.addMessage(idOrCode, input),
    onSuccess: (ticket) => {
      // Se siembra el detalle con la respuesta para que el mensaje aparezca sin
      // esperar a una nueva consulta.
      queryClient.setQueryData(queryKeys.portal.ticket(ticket.code), ticket);
      queryClient.setQueryData(queryKeys.portal.ticket(ticket.id), ticket);
      void queryClient.invalidateQueries({ queryKey: queryKeys.portal.all });
      notify.success('Mensaje enviado');
    },
    onError: (error) => {
      notify.fromError(error, 'No pudimos enviar el mensaje.');
    },
  });
}
