import {
  formatTicketCode,
  type Ticket as TicketContract,
  type TicketDetail,
  type TicketEvent as TicketEventContract,
  type TicketEventType,
  type TicketPriority,
  type TicketStatus,
  type UserRef,
} from '@conit/types';

import { toCategoryRef } from '../categories/categories.mapper';
import { toClientRef } from '../clients/clients.mapper';
import type {
  Category,
  Client,
  Project,
  Ticket,
  TicketEvent,
  User,
} from '../generated/prisma/client';
import { type MessageRecord, toMessage } from '../messages/messages.mapper';
import { toProjectRef } from '../projects/projects.mapper';

type UserSelection = Pick<User, 'id' | 'name' | 'email' | 'avatar'>;

/** Relaciones que el listado y el detalle necesitan resueltas. */
export const TICKET_RELATIONS = {
  client: { select: { id: true, name: true } },
  project: { select: { id: true, name: true, type: true, url: true } },
  category: { select: { id: true, name: true, color: true } },
  assignee: { select: { id: true, name: true, email: true, avatar: true } },
  createdBy: { select: { id: true, name: true, email: true, avatar: true } },
  _count: { select: { messages: true } },
} as const;

export type TicketRecord = Ticket & {
  client: Pick<Client, 'id' | 'name'>;
  project: Pick<Project, 'id' | 'name' | 'type' | 'url'> | null;
  category: Pick<Category, 'id' | 'name' | 'color'> | null;
  assignee: UserSelection | null;
  createdBy: UserSelection | null;
  _count?: { messages: number };
};

export type TicketEventRecord = TicketEvent & { actor: UserSelection | null };

export function toUserRef(user: UserSelection | null): UserRef | null {
  if (!user) return null;

  return { id: user.id, name: user.name, email: user.email, avatar: user.avatar };
}

export function toTicket(ticket: TicketRecord): TicketContract {
  return {
    id: ticket.id,
    number: ticket.number,
    // El codigo se compone aqui y no se almacena: derivarlo del correlativo
    // garantiza que no puedan divergir.
    code: formatTicketCode(ticket.number),
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status as TicketStatus,
    priority: ticket.priority as TicketPriority,
    client: toClientRef(ticket.client),
    project: toProjectRef(ticket.project),
    category: toCategoryRef(ticket.category),
    assignee: toUserRef(ticket.assignee),
    createdBy: toUserRef(ticket.createdBy),
    firstResponseAt: ticket.firstResponseAt?.toISOString() ?? null,
    resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
    closedAt: ticket.closedAt?.toISOString() ?? null,
    messageCount: ticket._count?.messages ?? 0,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

export function toTicketEvent(event: TicketEventRecord): TicketEventContract {
  return {
    id: event.id,
    ticketId: event.ticketId,
    type: event.type as TicketEventType,
    actor: toUserRef(event.actor),
    fromValue: event.fromValue,
    toValue: event.toValue,
    note: event.note,
    createdAt: event.createdAt.toISOString(),
  };
}

export function toTicketDetail(
  ticket: TicketRecord & { events: TicketEventRecord[]; messages: MessageRecord[] },
): TicketDetail {
  return {
    ...toTicket(ticket),
    events: ticket.events.map(toTicketEvent),
    messages: ticket.messages.map(toMessage),
  };
}
