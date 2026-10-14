import type { PaginationQuery } from './api';
import type { ClientRef } from './client';
import type { TicketStatus } from './ticket';
import type { UserRef } from './user';

/**
 * Bandeja de WhatsApp.
 *
 * Una conversacion por numero. Lo que escribe el contacto llega por el webhook
 * de Meta; lo que se le envia sale desde la bandeja o como aviso de un ticket.
 * El ticket no se crea solo: lo decide quien atiende el chat.
 */

export const WHATSAPP_MESSAGE_DIRECTIONS = {
  INBOUND: 'INBOUND',
  OUTBOUND: 'OUTBOUND',
} as const;

export type WhatsappMessageDirection =
  (typeof WHATSAPP_MESSAGE_DIRECTIONS)[keyof typeof WHATSAPP_MESSAGE_DIRECTIONS];

export const WHATSAPP_MESSAGE_STATUSES = {
  RECEIVED: 'RECEIVED',
  ACCEPTED: 'ACCEPTED',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  FAILED: 'FAILED',
} as const;

export type WhatsappMessageStatus =
  (typeof WHATSAPP_MESSAGE_STATUSES)[keyof typeof WHATSAPP_MESSAGE_STATUSES];

export const WHATSAPP_MESSAGE_STATUS_LABELS: Record<WhatsappMessageStatus, string> = {
  RECEIVED: 'Recibido',
  ACCEPTED: 'Enviando',
  SENT: 'Enviado',
  DELIVERED: 'Entregado',
  READ: 'Leido',
  FAILED: 'No entregado',
};

/**
 * Horas que Meta deja responder con texto libre desde el ultimo mensaje del
 * contacto. Pasado ese plazo solo se le puede escribir con una plantilla.
 */
export const WHATSAPP_REPLY_WINDOW_HOURS = 24;

export interface InboxMessage {
  id: string;
  direction: WhatsappMessageDirection;
  /** Tipo segun Meta: text, image, audio... */
  type: string;
  body: string;
  status: WhatsappMessageStatus;
  /** Motivo de Meta cuando un envio no se entrega. */
  error: string | null;
  /** Quien respondio desde la bandeja; `null` en lo recibido y en los avisos. */
  author: UserRef | null;
  /** Escrito por la respuesta automatica de IA. */
  aiGenerated: boolean;
  createdAt: string;
}

export interface InboxConversation {
  id: string;
  /** Numero con codigo de pais, solo digitos (`51936929213`). */
  phone: string;
  /** Nombre del perfil de WhatsApp; lo elige el contacto. */
  profileName: string | null;
  /** Cliente al que pertenece el numero; `null` si es desconocido. */
  client: ClientRef | null;
  lastMessage: Pick<InboxMessage, 'body' | 'direction' | 'createdAt'> | null;
  lastMessageAt: string;
  /** Si todavia se le puede responder con texto libre. */
  canReply: boolean;
  /** Hasta cuando dura la ventana; `null` si el contacto nunca escribio. */
  replyWindowEndsAt: string | null;
  unreadCount: number;
  /**
   * La respuesta automatica esta en pausa en esta conversacion: alguien del
   * equipo la tomo o la IA la derivo a un ticket.
   */
  aiPaused: boolean;
  aiPausedUntil: string | null;
}

/** Ticket creado desde una conversacion. */
export interface InboxTicketRef {
  id: string;
  code: string;
  subject: string;
  status: TicketStatus;
  createdAt: string;
}

export interface InboxConversationDetail extends InboxConversation {
  /** Mensajes en orden cronologico (los mas recientes, hasta un limite). */
  messages: InboxMessage[];
  /** Tickets creados desde esta conversacion, del mas reciente al mas antiguo. */
  tickets: InboxTicketRef[];
}

export interface InboxQuery extends PaginationQuery {
  /** `true` limita a las conversaciones con mensajes sin leer. */
  unreadOnly?: boolean;
}

export interface InboxReplyInput {
  body: string;
}

/** Horas que la respuesta automatica se aparta al intervenir una persona o derivar a ticket. */
export const WHATSAPP_AI_HANDOFF_HOURS = 24;

export interface InboxAiPauseInput {
  /** `true` pausa la IA en la conversacion; `false` la reanuda. */
  paused: boolean;
}
