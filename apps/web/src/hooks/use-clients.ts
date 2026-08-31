'use client';

import type { ClientWithCounts, CreateClientInput, UpdateClientInput } from '@conit/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notify } from '@/lib/notify';
import { queryKeys } from '@/lib/query-keys';
import { type ClientListQuery,clientsService } from '@/services/clients.service';

export function useClients(query: ClientListQuery) {
  return useQuery({
    queryKey: queryKeys.clients.list(query),
    queryFn: () => clientsService.list(query),
    // Mantiene la pagina anterior visible mientras llega la nueva: evita que
    // la tabla parpadee a vacio al cambiar de pagina o de filtro.
    placeholderData: (previous) => previous,
  });
}

/** Clientes activos para selectores; cambian poco, se cachean mas tiempo. */
export function useClientOptions(enabled = true) {
  return useQuery({
    queryKey: queryKeys.clients.options(),
    queryFn: () => clientsService.options(),
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateClientInput) => clientsService.create(input),
    onSuccess: (client) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      notify.success('Cliente creado', { description: client.name });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateClientInput }) =>
      clientsService.update(id, input),
    onSuccess: (client: ClientWithCounts) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      notify.success('Cliente actualizado', { description: client.name });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => clientsService.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      notify.success('Cliente eliminado');
    },
    onError: (error) => {
      // El 409 ("tiene tickets") es una regla de negocio, no un fallo: se
      // muestra tal cual porque su mensaje ya explica que hacer.
      notify.fromError(error, 'No se pudo eliminar el cliente.');
    },
  });
}
