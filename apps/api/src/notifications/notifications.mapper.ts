import { formatTicketCode, type Notification, type NotificationType } from '@conit/types';

import type {
  Notification as NotificationModel,
  Ticket,
} from '../generated/prisma/client';

export const NOTIFICATION_RELATIONS = {
  ticket: { select: { id: true, number: true } },
} as const;

export type NotificationRecord = NotificationModel & {
  ticket: Pick<Ticket, 'id' | 'number'> | null;
};

export function toNotification(notification: NotificationRecord): Notification {
  return {
    id: notification.id,
    type: notification.type as NotificationType,
    title: notification.title,
    body: notification.body,
    ticket: notification.ticket
      ? { id: notification.ticket.id, code: formatTicketCode(notification.ticket.number) }
      : null,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}
