import { type AuditEntry, formatTicketCode } from '@conit/types';

import type { Ticket } from '../generated/prisma/client';
import { type TicketEventRecord, toTicketEvent } from '../tickets/tickets.mapper';

/** Del ticket solo se trae lo necesario para identificarlo en la lista. */
export const AUDIT_RELATIONS = {
  actor: { select: { id: true, name: true, email: true, avatar: true } },
  ticket: { select: { id: true, number: true, subject: true } },
} as const;

type AuditRecord = TicketEventRecord & {
  ticket: Pick<Ticket, 'id' | 'number' | 'subject'>;
};

export function toAuditEntry(event: AuditRecord): AuditEntry {
  return {
    ...toTicketEvent(event),
    ticket: {
      id: event.ticket.id,
      code: formatTicketCode(event.ticket.number),
      subject: event.ticket.subject,
    },
  };
}
