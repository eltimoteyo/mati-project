import type {
  CategoryWithCounts,
  CreateCategoryInput,
  PaginatedData,
  PaginationQuery,
  UpdateCategoryInput,
} from '@conit/types';

import { apiClient } from '@/lib/api-client';
import { toQueryString } from '@/lib/query-string';

export interface CategoryListQuery extends PaginationQuery {
  status?: string;
}

/** Operaciones sobre el catalogo de categorias. */
export const categoriesService = {
  list(query: CategoryListQuery = {}): Promise<PaginatedData<CategoryWithCounts>> {
    return apiClient.get<PaginatedData<CategoryWithCounts>>(`/categories${toQueryString(query)}`);
  },

  get(id: string): Promise<CategoryWithCounts> {
    return apiClient.get<CategoryWithCounts>(`/categories/${id}`);
  },

  create(input: CreateCategoryInput): Promise<CategoryWithCounts> {
    return apiClient.post<CategoryWithCounts>('/categories', input);
  },

  update(id: string, input: UpdateCategoryInput): Promise<CategoryWithCounts> {
    return apiClient.patch<CategoryWithCounts>(`/categories/${id}`, input);
  },

  remove(id: string): Promise<null> {
    return apiClient.delete<null>(`/categories/${id}`);
  },
};
