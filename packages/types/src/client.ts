/**
 * Cliente: la empresa o persona que contrata los servicios de CONIT.
 *
 * Es una entidad distinta de `User`. Un cliente puede existir sin credenciales
 * (dado de alta por el administrador) y, cuando llegue el portal, se le
 * asociara un `User` con rol CLIENT mediante `userId`.
 */

export const CLIENT_STATUSES = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export type ClientStatus = (typeof CLIENT_STATUSES)[keyof typeof CLIENT_STATUSES];

export interface Client {
  id: string;
  /** Razon social o nombre comercial. */
  name: string;
  /** Identificador fiscal (RUC en Peru). Opcional. */
  taxId: string | null;
  /** Persona de contacto dentro de la empresa. */
  contactName: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: ClientStatus;
  /** Usuario con acceso al portal, cuando exista. */
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Cliente con los contadores que necesita el listado. */
export interface ClientWithCounts extends Client {
  counts: {
    projects: number;
    tickets: number;
    openTickets: number;
  };
}

export interface CreateClientInput {
  name: string;
  email: string;
  taxId?: string | null;
  contactName?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  status?: ClientStatus;
}

export type UpdateClientInput = Partial<CreateClientInput>;

/** Referencia ligera, para selectores y para anidar en otras entidades. */
export interface ClientRef {
  id: string;
  name: string;
}
