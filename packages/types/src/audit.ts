import type { TicketEvent, TicketEventType } from './ticket';

/* -----------------------------------------------------------------------------
 * Historial de auditoria
 * -------------------------------------------------------------------------- */

/**
 * Una entrada del historial global.
 *
 * Es el mismo evento que ya se guarda en la ficha de cada ticket, enriquecido
 * con la referencia al ticket para poder leerlo fuera de su contexto. No se
 * duplica el registro: el historial y la ficha leen la misma tabla, de modo que
 * no pueden contradecirse.
 */
export interface AuditEntry extends TicketEvent {
  ticket: AuditTicketRef;
}

export interface AuditTicketRef {
  id: string;
  code: string;
  subject: string;
}

export interface AuditFilters {
  /** Busca en el asunto del ticket, el codigo y los valores del cambio. */
  search?: string;
  type?: TicketEventType;
  actorId?: string;
  ticketId?: string;
  /** Fechas ISO inclusivas sobre el momento del evento. */
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Cifras de cabecera del historial.
 *
 * Se calculan sobre el mismo filtro que la tabla: si el usuario acota a una
 * semana, el resumen habla de esa semana y no del total historico.
 */
export interface AuditSummary {
  /** Eventos que cumplen el filtro. */
  total: number;
  /** Tickets distintos afectados. */
  tickets: number;
  /** Usuarios distintos que provocaron algun evento. */
  actors: number;
  /** Reparto por tipo, de mayor a menor. */
  byType: AuditTypeCount[];
}

export interface AuditTypeCount {
  type: TicketEventType;
  count: number;
}
