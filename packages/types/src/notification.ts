/* -----------------------------------------------------------------------------
 * Notificaciones
 * -------------------------------------------------------------------------- */

export const NOTIFICATION_TYPES = {
  TICKET_ASSIGNED: 'TICKET_ASSIGNED',
  TICKET_STATUS_CHANGED: 'TICKET_STATUS_CHANGED',
  TICKET_MESSAGE: 'TICKET_MESSAGE',
  TICKET_CRITICAL: 'TICKET_CRITICAL',
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  TICKET_ASSIGNED: 'Tickets asignados',
  TICKET_STATUS_CHANGED: 'Cambios de estado',
  TICKET_MESSAGE: 'Nuevos mensajes',
  TICKET_CRITICAL: 'Incidencias criticas',
};

export const NOTIFICATION_TYPE_DESCRIPTIONS: Record<NotificationType, string> = {
  TICKET_ASSIGNED: 'Cuando alguien te asigna una incidencia.',
  TICKET_STATUS_CHANGED: 'Cuando cambia el estado de un ticket que llevas.',
  TICKET_MESSAGE: 'Cuando se escribe en la conversacion de un ticket que llevas.',
  TICKET_CRITICAL: 'Cuando se registra una incidencia critica sin responsable.',
};

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Ticket relacionado, para poder enlazar desde el aviso. */
  ticket: NotificationTicketRef | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationTicketRef {
  id: string;
  code: string;
}

export interface NotificationFilters {
  /** `true` limita a las no leidas. */
  unreadOnly?: boolean;
  type?: NotificationType;
  page?: number;
  pageSize?: number;
}

export interface NotificationPreference {
  type: NotificationType;
  enabled: boolean;
}

/** Respuesta del recuento que alimenta el indicador de la campana. */
export interface NotificationCount {
  unread: number;
}
