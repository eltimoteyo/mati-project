import type { Message as MessageContract, MessageVisibility } from '@conit/types';

import type { Message, User } from '../generated/prisma/client';
import { toUserRef } from '../tickets/tickets.mapper';

type AuthorSelection = Pick<User, 'id' | 'name' | 'email' | 'avatar'>;

/** Autor incluido en toda consulta de mensajes. */
export const MESSAGE_RELATIONS = {
  author: { select: { id: true, name: true, email: true, avatar: true } },
} as const;

export type MessageRecord = Message & { author: AuthorSelection | null };

export function toMessage(message: MessageRecord): MessageContract {
  return {
    id: message.id,
    ticketId: message.ticketId,
    body: message.body,
    visibility: message.visibility as MessageVisibility,
    author: toUserRef(message.author),
    readAt: message.readAt?.toISOString() ?? null,
    editedAt: message.editedAt?.toISOString() ?? null,
    createdAt: message.createdAt.toISOString(),
  };
}
