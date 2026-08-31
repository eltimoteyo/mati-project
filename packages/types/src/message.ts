import type { UserRef } from './ticket';

/**
 * Mensaje dentro de la conversacion de un ticket.
 *
 * Los mensajes son **comunicacion**; `TicketEvent` es **auditoria**. Separarlos
 * evita que el historial de cambios se llene de texto libre y permite que la
 * conversacion se muestre como tal, con su propio hilo y su propia visibilidad.
 */

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
