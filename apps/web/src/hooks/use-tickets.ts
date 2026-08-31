'use client';

import type { CreateTicketInput, TicketQuery, UpdateTicketInput, UserRef } from '@conit/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import { notify } from '@/lib/notify';
import { queryKeys } from '@/lib/query-keys';
import { ticketsService } from '@/services/tickets.service';

export function useTickets(query: TicketQuery) {
  return useQuery({
    queryKey: queryKeys.tickets.list(query),
    queryFn: () => ticketsService.list(query),
    placeholderData: (previous) => previous,
  });
}

export function useTicket(idOrCode: string) {
  return useQuery({
    queryKey: queryKeys.tickets.detail(idOrCode),
    queryFn: () => ticketsService.get(idOrCode),
    enabled: Boolean(idOrCode),
  });
}

/** Administradores activos, para el selector de responsable. */
export function useAssignableUsers(enabled = true) {
  return useQuery({
    queryKey: queryKeys.users.assignable(),
    queryFn: () => apiClient.get<UserRef[]>('/users/options'),
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTicketInput) => ticketsService.create(input),
    onSuccess: (ticket) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      notify.success(`Ticket ${ticket.code} creado`, { description: ticket.subject });
    },
  });
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ idOrCode, input }: { idOrCode: string; input: UpdateTicketInput }) =>
      ticketsService.update(idOrCode, input),
    onSuccess: (ticket) => {
      // Se siembra el detalle con la respuesta para que la vista se actualice
      // sin esperar a un refetch, y se invalidan los listados y el resumen.
      queryClient.setQueryData(queryKeys.tickets.detail(ticket.code), ticket);
      queryClient.setQueryData(queryKeys.tickets.detail(ticket.id), ticket);
      void queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      notify.success(`Ticket ${ticket.code} actualizado`);
    },
    onError: (error) => {
      // Incluye las transiciones de estado no permitidas, cuyo mensaje ya
      // enumera las opciones validas.
      notify.fromError(error, 'No se pudo actualizar el ticket.');
    },
  });
}

export function useDeleteTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (idOrCode: string) => ticketsService.remove(idOrCode),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      notify.success('Ticket eliminado');
    },
    onError: (error) => {
      notify.fromError(error, 'No se pudo eliminar el ticket.');
    },
  });
}
