import type {
  CreateProjectInput,
  PaginatedData,
  PaginationQuery,
  ProjectRef,
  ProjectWithClient,
  UpdateProjectInput,
} from '@conit/types';

import { apiClient } from '@/lib/api-client';
import { toQueryString } from '@/lib/query-string';

export interface ProjectListQuery extends PaginationQuery {
  clientId?: string;
  type?: string;
  status?: string;
  expiringSoon?: boolean;
}

/** Operaciones sobre proyectos y servicios contratados. */
export const projectsService = {
  list(query: ProjectListQuery = {}): Promise<PaginatedData<ProjectWithClient>> {
    return apiClient.get<PaginatedData<ProjectWithClient>>(`/projects${toQueryString(query)}`);
  },

  /** Servicios activos de un cliente, para el formulario de ticket. */
  optionsByClient(clientId: string): Promise<ProjectRef[]> {
    return apiClient.get<ProjectRef[]>(`/projects/options/${clientId}`);
  },

  get(id: string): Promise<ProjectWithClient> {
    return apiClient.get<ProjectWithClient>(`/projects/${id}`);
  },

  create(input: CreateProjectInput): Promise<ProjectWithClient> {
    return apiClient.post<ProjectWithClient>('/projects', input);
  },

  update(id: string, input: UpdateProjectInput): Promise<ProjectWithClient> {
    return apiClient.patch<ProjectWithClient>(`/projects/${id}`, input);
  },

  remove(id: string): Promise<null> {
    return apiClient.delete<null>(`/projects/${id}`);
  },
};
