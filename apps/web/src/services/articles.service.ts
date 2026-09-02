import type {
  Article,
  ArticleFilters,
  ArticleListItem,
  ArticleSummary,
  CreateArticleInput,
  PaginatedData,
  UpdateArticleInput,
} from '@conit/types';

import { apiClient } from '@/lib/api-client';
import { toQueryString } from '@/lib/query-string';

/** Base de conocimiento. Las rutas aceptan el UUID o el slug. */
export const articlesService = {
  list(filters: ArticleFilters = {}): Promise<PaginatedData<ArticleListItem>> {
    return apiClient.get<PaginatedData<ArticleListItem>>(`/articles${toQueryString(filters)}`);
  },

  summary(): Promise<ArticleSummary> {
    return apiClient.get<ArticleSummary>('/articles/summary');
  },

  get(idOrSlug: string): Promise<Article> {
    return apiClient.get<Article>(`/articles/${idOrSlug}`);
  },

  /** Registra una lectura. Se separa de `get` para que editar no cuente. */
  registerView(idOrSlug: string): Promise<Article> {
    return apiClient.post<Article>(`/articles/${idOrSlug}/views`, {});
  },

  create(input: CreateArticleInput): Promise<Article> {
    return apiClient.post<Article>('/articles', input);
  },

  update(idOrSlug: string, input: UpdateArticleInput): Promise<Article> {
    return apiClient.patch<Article>(`/articles/${idOrSlug}`, input);
  },

  remove(idOrSlug: string): Promise<null> {
    return apiClient.delete<null>(`/articles/${idOrSlug}`);
  },
};
