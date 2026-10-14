import {
  formatTicketCode,
  type InboxConversation,
  type InboxMessage,
  type InboxTicketRef,
  type TicketStatus,
  WHATSAPP_REPLY_WINDOW_HOURS,
  type WhatsappMessageDirection,
  type WhatsappMessageStatus,
} from '@conit/types';

import { toClientRef } from '../clients/clients.mapper';
import type {
  Client,
  Ticket,
  User,
  WhatsappConversation,
  WhatsappMessage,
} from '../generated/prisma/client';
import { toUserRef } from '../tickets/tickets.mapper';

const REPLY_WINDOW_MS = WHATSAPP_REPLY_WINDOW_HOURS * 60 * 60 * 1000;

/** Relaciones que necesita una fila del listado. */
export const CONVERSATION_LIST_RELATIONS = {
  client: { select: { id: true, name: true } },
  // El ultimo mensaje, para la vista previa de la fila.
  messages: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { body: true, direction: true, createdAt: true },
  },
} as const;

export type ConversationRecord = WhatsappConversation & {
  client: Pick<Client, 'id' | 'name'> | null;
  /** Del mas reciente al mas antiguo; basta con el primero. */
  messages: Array<Pick<WhatsappMessage, 'body' | 'direction' | 'createdAt'>>;
};

export type InboxMessageRecord = WhatsappMessage & {
  author: Pick<User, 'id' | 'name' | 'email' | 'avatar'> | null;
};

/** Fin de la ventana para responder con texto libre; `null` si nunca escribio. */
export function replyWindowEnd(lastInboundAt: Date | null): Date | null {
  return lastInboundAt ? new Date(lastInboundAt.getTime() + REPLY_WINDOW_MS) : null;
}

export function toInboxConversation(
  conversation: ConversationRecord,
  now: Date = new Date(),
): InboxConversation {
  const windowEnd = replyWindowEnd(conversation.lastInboundAt);
  const last = conversation.messages[0];

  return {
    id: conversation.id,
    phone: conversation.phone,
    profileName: conversation.profileName,
    client: conversation.client ? toClientRef(conversation.client) : null,
    lastMessage: last
      ? {
          body: last.body,
          direction: last.direction as WhatsappMessageDirection,
          createdAt: last.createdAt.toISOString(),
        }
      : null,
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    canReply: windowEnd !== null && windowEnd > now,
    replyWindowEndsAt: windowEnd?.toISOString() ?? null,
    unreadCount: conversation.unreadCount,
    aiPaused: conversation.aiPausedUntil !== null && conversation.aiPausedUntil > now,
    aiPausedUntil: conversation.aiPausedUntil?.toISOString() ?? null,
  };
}

export function toInboxMessage(message: InboxMessageRecord): InboxMessage {
  return {
    id: message.id,
    direction: message.direction as WhatsappMessageDirection,
    type: message.type,
    body: message.body,
    status: message.status as WhatsappMessageStatus,
    error: message.error,
    author: toUserRef(message.author),
    aiGenerated: message.aiGenerated,
    createdAt: message.createdAt.toISOString(),
  };
}

export function toInboxTicketRef(
  ticket: Pick<Ticket, 'id' | 'number' | 'subject' | 'status' | 'createdAt'>,
): InboxTicketRef {
  return {
    id: ticket.id,
    code: formatTicketCode(ticket.number),
    subject: ticket.subject,
    status: ticket.status as TicketStatus,
    createdAt: ticket.createdAt.toISOString(),
  };
}
