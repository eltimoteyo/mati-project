import type { Message } from './message';
import type { ProjectRef } from './project';
import type { TicketPriority, TicketStatus } from './ticket';

/* -----------------------------------------------------------------------------
 * Portal del cliente
 * -------------------------------------------------------------------------- */

/**
 * Contratos de lo que ve un cliente sobre sus propias incidencias.
 *
 * Son deliberadamente distintos de los del panel y no una version recortada en
 * tiempo de ejecucion: si el cliente reutilizase `TicketDetail`, cualquier
 * campo nuevo que se anadiera para soporte —una nota interna, el historial de
 * auditoria— quedaria expuesto sin que nadie lo advirtiera. Aqui, para
 * filtrarse tendria que anadirse a mano a este fichero.
 */

/** Ficha del cliente y de la persona que ha entrado. */
export interface PortalProfile {
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    lastLoginAt: string | null;
  };
  client: {
    id: string;
    name: string;
    taxId: string | null;
    contactName: string | null;
    email: string;
    phone: string | null;
    address: string | null;
  };
  /** Servicios contratados, para poder senalar cual falla al abrir una incidencia. */
  services: ProjectRef[];
  counts: PortalTicketCounts;
}

export interface PortalTicketCounts {
  /** Incidencias en curso: nuevas, en revision o en proceso. */
  open: number;
  resolved: number;
  total: number;
  /** De las abiertas, cuantas siguen sin una primera respuesta de soporte. */
  awaitingResponse: number;
}

/** Incidencia tal como la ve su cliente. */
export interface PortalTicket {
  id: string;
  code: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  service: ProjectRef | null;
  /** Nombre de quien la atiende. `null` mientras no se ha asignado. */
  attendedBy: string | null;
  /** Momento de la primera respuesta de soporte; `null` si aun no la hubo. */
  firstResponseAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Mensajes visibles para el cliente en la conversacion. */
  messageCount: number;
}

export interface PortalTicketDetail extends PortalTicket {
  description: string;
  /** Solo los mensajes publicos. Las notas internas no salen de aqui. */
  messages: Message[];
  /** Cambios de estado, para seguir el avance sin ver la auditoria completa. */
  timeline: PortalTimelineEntry[];
}

export interface PortalTimelineEntry {
  status: TicketStatus;
  /**
   * Cuando se alcanzo ese estado.
   *
   * `null` cuando no consta: la incidencia esta en un estado del que no hay
   * registro de cuando se cambio (por ejemplo, datos importados). Se prefiere
   * decir "no consta" a estampar una fecha aproximada que pareceria exacta.
   */
  at: string | null;
}

export interface PortalTicketFilters {
  status?: TicketStatus;
  /** Limita a las incidencias en curso. */
  openOnly?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Alta de incidencia desde el portal.
 *
 * No incluye `clientId`, `assigneeId` ni `status`: el cliente es el de la
 * sesion, y decidir quien atiende o en que estado entra es competencia de
 * soporte. Aceptarlos permitiria abrir tickets en nombre de otro.
 */
export interface CreatePortalTicketInput {
  subject: string;
  description: string;
  /** Servicio afectado; debe pertenecer al propio cliente. */
  projectId?: string | null;
  priority?: TicketPriority;
}

export interface CreatePortalMessageInput {
  body: string;
}
