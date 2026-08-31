import type { PaginationQuery } from './api';
import type { CategoryRef } from './category';
import type { ClientRef } from './client';
import type { Message } from './message';
import type { ProjectRef } from './project';

/** Referencia ligera a un usuario, para autores y responsables. */
export interface UserRef {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

/* -----------------------------------------------------------------------------
 * Estados
 * -------------------------------------------------------------------------- */

export const TICKET_STATUSES = {
  NEW: 'NEW',
  IN_REVIEW: 'IN_REVIEW',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const;

export type TicketStatus = (typeof TICKET_STATUSES)[keyof typeof TICKET_STATUSES];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  NEW: 'Nuevo',
  IN_REVIEW: 'En revision',
  IN_PROGRESS: 'En proceso',
  RESOLVED: 'Resuelto',
  CLOSED: 'Cerrado',
};

/**
 * Transiciones permitidas entre estados.
 *
 * El flujo se declara aqui, en el paquete compartido, para que la API lo
 * imponga y la interfaz solo ofrezca las opciones validas. Un ticket cerrado
 * se puede reabrir a "en proceso", pero no volver a "nuevo": ese estado
 * significa "sin revisar todavia" y reutilizarlo falsearia las metricas.
 */
export const TICKET_STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  NEW: ['IN_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_REVIEW: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['IN_REVIEW', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['IN_PROGRESS', 'CLOSED'],
  CLOSED: ['IN_PROGRESS'],
};

/** Estados que cuentan como "abierto" (pendientes de atencion). */
export const OPEN_TICKET_STATUSES: TicketStatus[] = ['NEW', 'IN_REVIEW', 'IN_PROGRESS'];

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return TICKET_STATUS_TRANSITIONS[from].includes(to);
}

/* -----------------------------------------------------------------------------
 * Prioridad
 * -------------------------------------------------------------------------- */

export const TICKET_PRIORITIES = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

export type TicketPriority = (typeof TICKET_PRIORITIES)[keyof typeof TICKET_PRIORITIES];

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Critica',
};

/* -----------------------------------------------------------------------------
 * Historial
 * -------------------------------------------------------------------------- */

export const TICKET_EVENT_TYPES = {
  CREATED: 'CREATED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  PRIORITY_CHANGED: 'PRIORITY_CHANGED',
  ASSIGNED: 'ASSIGNED',
  UNASSIGNED: 'UNASSIGNED',
  CATEGORY_CHANGED: 'CATEGORY_CHANGED',
  NOTE_ADDED: 'NOTE_ADDED',
  UPDATED: 'UPDATED',
} as const;

export type TicketEventType = (typeof TICKET_EVENT_TYPES)[keyof typeof TICKET_EVENT_TYPES];

export interface TicketEvent {
  id: string;
  ticketId: string;
  type: TicketEventType;
  /** Quien lo provoco. `null` si el actor fue eliminado. */
  actor: UserRef | null;
  /** Valores anterior y nuevo, ya formateados para mostrar. */
  fromValue: string | null;
  toValue: string | null;
  /** Texto libre de las notas internas. */
  note: string | null;
  createdAt: string;
}

/* -----------------------------------------------------------------------------
 * Ticket
 * -------------------------------------------------------------------------- */

export interface Ticket {
  id: string;
  /** Numero correlativo asignado por la base de datos. */
  number: number;
  /** Codigo visible derivado del numero, por ejemplo `CNT-0042`. */
  code: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  client: ClientRef;
  project: ProjectRef | null;
  category: CategoryRef | null;
  assignee: UserRef | null;
  createdBy: UserRef | null;
  /** Momento de la primera respuesta de soporte. */
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  /** Mensajes en la conversacion; permite ordenar la bandeja sin otra consulta. */
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Ticket con su conversacion e historial, para la vista de detalle. */
export interface TicketDetail extends Ticket {
  events: TicketEvent[];
  messages: Message[];
}

export interface CreateTicketInput {
  subject: string;
  description: string;
  clientId: string;
  projectId?: string | null;
  categoryId?: string | null;
  priority?: TicketPriority;
  assigneeId?: string | null;
}

export type UpdateTicketInput = Partial<Omit<CreateTicketInput, 'clientId'>> & {
  status?: TicketStatus;
};

/** Filtros aceptados por el listado de tickets. */
export interface TicketQuery extends PaginationQuery {
  status?: TicketStatus;
  priority?: TicketPriority;
  clientId?: string;
  categoryId?: string;
  projectId?: string;
  assigneeId?: string;
  /** `true` limita a los estados abiertos. */
  openOnly?: boolean;
}

/** Genera el codigo visible a partir del correlativo. */
export function formatTicketCode(ticketNumber: number): string {
  return `CNT-${String(ticketNumber).padStart(4, '0')}`;
}
