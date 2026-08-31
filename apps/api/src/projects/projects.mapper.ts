import type {
  Project as ProjectContract,
  ProjectRef,
  ProjectStatus,
  ProjectWithClient,
  ServiceType,
} from '@conit/types';

import { toClientRef } from '../clients/clients.mapper';
import type { Client, Project } from '../generated/prisma/client';

/** Registro con el cliente y el recuento de tickets ya resueltos. */
export type ProjectRecord = Project & {
  client: Pick<Client, 'id' | 'name'>;
  _count?: { tickets: number };
};

export function toProject(project: Project): ProjectContract {
  return {
    id: project.id,
    clientId: project.clientId,
    name: project.name,
    type: project.type as ServiceType,
    description: project.description,
    url: project.url,
    status: project.status as ProjectStatus,
    startedAt: project.startedAt?.toISOString() ?? null,
    expiresAt: project.expiresAt?.toISOString() ?? null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export function toProjectWithClient(project: ProjectRecord): ProjectWithClient {
  return {
    ...toProject(project),
    client: toClientRef(project.client),
    counts: { tickets: project._count?.tickets ?? 0 },
  };
}

export function toProjectRef(
  project: Pick<Project, 'id' | 'name' | 'type' | 'url'> | null,
): ProjectRef | null {
  if (!project) return null;

  return {
    id: project.id,
    name: project.name,
    type: project.type as ServiceType,
    url: project.url,
  };
}
