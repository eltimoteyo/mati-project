import type { ClientRef } from './client';

/**
 * Proyecto o servicio contratado por un cliente.
 *
 * Cubre todo lo que CONIT desarrolla y mantiene: desde una pagina web hasta
 * un dominio o un buzon corporativo. Un ticket puede referirse al servicio
 * concreto que presenta la incidencia.
 */

export const SERVICE_TYPES = {
  WEBSITE: 'WEBSITE',
  WEB_SYSTEM: 'WEB_SYSTEM',
  VIRTUAL_CLASSROOM: 'VIRTUAL_CLASSROOM',
  HOSTING: 'HOSTING',
  DOMAIN: 'DOMAIN',
  EMAIL: 'EMAIL',
  DATABASE: 'DATABASE',
  OTHER: 'OTHER',
} as const;

export type ServiceType = (typeof SERVICE_TYPES)[keyof typeof SERVICE_TYPES];

/** Etiquetas en espanol para la interfaz. */
export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  WEBSITE: 'Pagina web',
  WEB_SYSTEM: 'Sistema web',
  VIRTUAL_CLASSROOM: 'Aula virtual',
  HOSTING: 'Hosting',
  DOMAIN: 'Dominio',
  EMAIL: 'Correo corporativo',
  DATABASE: 'Base de datos',
  OTHER: 'Otro',
};

export const PROJECT_STATUSES = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[keyof typeof PROJECT_STATUSES];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  ACTIVE: 'Activo',
  SUSPENDED: 'Suspendido',
  ARCHIVED: 'Archivado',
};

export interface Project {
  id: string;
  clientId: string;
  name: string;
  type: ServiceType;
  description: string | null;
  /** Dominio o URL del servicio. */
  url: string | null;
  status: ProjectStatus;
  /** Inicio del servicio o de la contratacion. */
  startedAt: string | null;
  /** Vencimiento; relevante sobre todo en hosting y dominios. */
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Proyecto con su cliente resuelto, para listados. */
export interface ProjectWithClient extends Project {
  client: ClientRef;
  counts: {
    tickets: number;
  };
}

export interface CreateProjectInput {
  clientId: string;
  name: string;
  type: ServiceType;
  description?: string | null;
  url?: string | null;
  status?: ProjectStatus;
  startedAt?: string | null;
  expiresAt?: string | null;
}

export type UpdateProjectInput = Partial<Omit<CreateProjectInput, 'clientId'>>;

/**
 * Referencia ligera a un servicio.
 *
 * Incluye la URL porque las vistas que muestran un servicio referenciado
 * (el detalle de un ticket, por ejemplo) ofrecen abrirlo directamente, y
 * pedir el proyecto completo solo para eso seria una consulta de mas.
 */
export interface ProjectRef {
  id: string;
  name: string;
  type: ServiceType;
  url: string | null;
}
