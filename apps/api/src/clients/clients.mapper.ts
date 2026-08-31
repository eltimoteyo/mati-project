import type {
  Client as ClientContract,
  ClientRef,
  ClientStatus,
  ClientWithCounts,
} from '@conit/types';

import type { Client } from '../generated/prisma/client';

/**
 * Recuentos que Prisma puede resolver directamente.
 *
 * Los tickets abiertos NO se piden aqui: `_count` no admite alias, asi que no
 * es posible pedir dos recuentos de la misma relacion con filtros distintos.
 * Se calculan con una agregacion aparte en `ClientsService`.
 */
export const CLIENT_COUNTS_SELECT = {
  _count: { select: { projects: true, tickets: true } },
} as const;

export type ClientRecord = Client & {
  _count?: { projects: number; tickets: number };
};

export function toClient(client: Client): ClientContract {
  return {
    id: client.id,
    name: client.name,
    taxId: client.taxId,
    contactName: client.contactName,
    email: client.email,
    phone: client.phone,
    address: client.address,
    notes: client.notes,
    status: client.status as ClientStatus,
    userId: client.userId,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  };
}

export function toClientWithCounts(client: ClientRecord, openTickets = 0): ClientWithCounts {
  return {
    ...toClient(client),
    counts: {
      projects: client._count?.projects ?? 0,
      tickets: client._count?.tickets ?? 0,
      openTickets,
    },
  };
}

export function toClientRef(client: Pick<Client, 'id' | 'name'>): ClientRef {
  return { id: client.id, name: client.name };
}
