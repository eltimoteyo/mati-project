'use client';

import type { ArticleFilters, CreateArticleInput, UpdateArticleInput } from '@conit/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notify } from '@/lib/notify';
import { queryKeys } from '@/lib/query-keys';
import { articlesService } from '@/services/articles.service';

export function useArticles(filters: ArticleFilters) {
  return useQuery({
    queryKey: queryKeys.articles.list(filters),
    queryFn: () => articlesService.list(filters),
    placeholderData: (previous) => previous,
  });
}

export function useArticlesSummary() {
  return useQuery({
    queryKey: queryKeys.articles.summary(),
    queryFn: () => articlesService.summary(),
  });
}

export function useArticle(idOrSlug: string) {
  return useQuery({
    queryKey: queryKeys.articles.detail(idOrSlug),
    queryFn: () => articlesService.get(idOrSlug),
    enabled: Boolean(idOrSlug),
  });
}

export function useCreateArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateArticleInput) => articlesService.create(input),
    onSuccess: (article) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
      notify.success('Articulo creado', { description: article.title });
    },
  });
}

export function useUpdateArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ idOrSlug, input }: { idOrSlug: string; input: UpdateArticleInput }) =>
      articlesService.update(idOrSlug, input),
    onSuccess: (article) => {
      // El slug puede haber cambiado: se siembran ambas claves para que la
      // vista abierta se refresque sea cual sea la que uso para cargar.
      queryClient.setQueryData(queryKeys.articles.detail(article.id), article);
      queryClient.setQueryData(queryKeys.articles.detail(article.slug), article);
      void queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
      notify.success('Articulo actualizado');
    },
  });
}

export function useDeleteArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (idOrSlug: string) => articlesService.remove(idOrSlug),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
      notify.success('Articulo eliminado');
    },
    onError: (error) => {
      notify.fromError(error, 'No se pudo eliminar el articulo.');
    },
  });
}

/**
 * Registra una lectura.
 *
 * No invalida el detalle: el unico cambio es el contador, y refrescar el
 * articulo entero al abrirlo provocaria un parpadeo del contenido.
 */
export function useRegisterArticleView() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (idOrSlug: string) => articlesService.registerView(idOrSlug),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.articles.summary() });
    },
    // Una visita perdida no merece molestar a quien esta leyendo.
    onError: () => undefined,
  });
}
