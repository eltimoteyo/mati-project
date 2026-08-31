'use client';

import type { CreateCategoryInput, UpdateCategoryInput } from '@conit/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notify } from '@/lib/notify';
import { queryKeys } from '@/lib/query-keys';
import { categoriesService, type CategoryListQuery } from '@/services/categories.service';

export function useCategories(query: CategoryListQuery) {
  return useQuery({
    queryKey: queryKeys.categories.list(query),
    queryFn: () => categoriesService.list(query),
    placeholderData: (previous) => previous,
  });
}

/**
 * Catalogo completo de categorias activas, para los selectores.
 * Es una lista corta y estable, asi que se pide de una vez y se cachea.
 */
export function useCategoryOptions(enabled = true) {
  return useQuery({
    queryKey: queryKeys.categories.list({ options: true }),
    queryFn: () => categoriesService.list({ status: 'ACTIVE', pageSize: 100, sortOrder: 'asc' }),
    select: (data) => data.items,
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCategoryInput) => categoriesService.create(input),
    onSuccess: (category) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      notify.success('Categoria creada', { description: category.name });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCategoryInput }) =>
      categoriesService.update(id, input),
    onSuccess: (category) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all });
      notify.success('Categoria actualizada', { description: category.name });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => categoriesService.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      notify.success('Categoria eliminada');
    },
    onError: (error) => {
      notify.fromError(error, 'No se pudo eliminar la categoria.');
    },
  });
}
