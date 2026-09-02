import type { UserRef } from './user';

/**
 * Mensaje dentro de la conversacion de un ticket.
 *
 * Los mensajes son **comunicacion**; `TicketEvent` es **auditoria**. Separarlos
 * evita que el historial de cambios se llene de texto libre y permite que la
 * conversacion se muestre como tal, con su propio hilo y su propia visibilidad.
 */

/**
 * De donde salio el mensaje.
 *
 * Permite que el hilo distinga lo que escribio soporte de lo que llego del
 * cliente sin depender de si este tiene cuenta: un correo entrante no trae
 * autor, y sin este dato se mostraria igual que un mensaje del sistema.
 */
export const MESSAGE_SOURCES = {
  PANEL: 'PANEL',
  EMAIL: 'EMAIL',
  PORTAL: 'PORTAL',
} as const;

export type MessageSource = (typeof MESSAGE_SOURCES)[keyof typeof MESSAGE_SOURCES];

export const MESSAGE_SOURCE_LABELS: Record<MessageSource, string> = {
  PANEL: 'Panel',
  EMAIL: 'Por correo',
  PORTAL: 'Portal del cliente',
};

export const MESSAGE_VISIBILITIES = {
  /** Visible para el cliente en el portal (cuando exista). */
  PUBLIC: 'PUBLIC',
  /** Solo para el equipo de soporte. */
  INTERNAL: 'INTERNAL',
} as const;

export type MessageVisibility =
  (typeof MESSAGE_VISIBILITIES)[keyof typeof MESSAGE_VISIBILITIES];

export const MESSAGE_VISIBILITY_LABELS: Record<MessageVisibility, string> = {
  PUBLIC: 'Respuesta al cliente',
  INTERNAL: 'Nota interna',
};

export interface Message {
  id: string;
  ticketId: string;
  body: string;
  visibility: MessageVisibility;
  source: MessageSource;
  /** Autor; `null` si la cuenta se elimino despues. */
  author: UserRef | null;
  /**
   * Momento en que el cliente lo leyo. Solo aplica a mensajes publicos y
   * quedara en `null` hasta que exista el portal de cliente.
   */
  readAt: string | null;
  /** Marca de edicion; `null` si nunca se edito. */
  editedAt: string | null;
  createdAt: string;
}

export interface CreateMessageInput {
  body: string;
  visibility?: MessageVisibility;
}

export interface UpdateMessageInput {
  body: string;
}
