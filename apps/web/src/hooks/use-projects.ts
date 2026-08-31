'use client';

import type { CreateProjectInput, UpdateProjectInput } from '@conit/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notify } from '@/lib/notify';
import { queryKeys } from '@/lib/query-keys';
import { type ProjectListQuery,projectsService } from '@/services/projects.service';

export function useProjects(query: ProjectListQuery) {
  return useQuery({
    queryKey: queryKeys.projects.list(query),
    queryFn: () => projectsService.list(query),
    placeholderData: (previous) => previous,
  });
}

/**
 * Servicios de un cliente concreto.
 * Se desactiva sin cliente seleccionado: pedir los servicios de "ninguno" no
 * tiene sentido y provocaria una peticion con un id vacio.
 */
export function useProjectOptions(clientId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.projects.optionsByClient(clientId ?? 'none'),
    queryFn: () => projectsService.optionsByClient(clientId as string),
    enabled: Boolean(clientId),
    staleTime: 60_000,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProjectInput) => projectsService.create(input),
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      notify.success('Servicio registrado', { description: project.name });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProjectInput }) =>
      projectsService.update(id, input),
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all });
      notify.success('Servicio actualizado', { description: project.name });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => projectsService.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      notify.success('Servicio eliminado');
    },
    onError: (error) => {
      notify.fromError(error, 'No se pudo eliminar el servicio.');
    },
  });
}
