/**
 * Tipos de usuario compartidos.
 *
 * Los valores coinciden exactamente con los enums de Prisma (`UserRole`,
 * `UserStatus`) para poder convertir entre capas sin mapeos manuales.
 */

export const USER_ROLES = {
  ADMIN: 'ADMIN',
  SYSTEMS: 'SYSTEMS',
  CLIENT: 'CLIENT',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const USER_STATUSES = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export type UserStatus = (typeof USER_STATUSES)[keyof typeof USER_STATUSES];

/**
 * Representacion publica de un usuario.
 * Nunca incluye `passwordHash` ni ningun dato sensible.
 */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  avatar: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Referencia compacta a un usuario para autores y responsables.
 *
 * `avatar` es obligatorio y anulable, no opcional: los mapeadores siempre lo
 * resuelven, y dejarlo opcional obligaria a cada consumidor a distinguir entre
 * "sin foto" y "no vino en la respuesta", que aqui son lo mismo.
 */
export interface UserRef {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

/** Payload decodificado de un access token. */
export interface AccessTokenPayload {
  /** Identificador del usuario (subject). */
  sub: string;
  email: string;
  role: UserRole;
  /**
   * Identificador de la sesion persistida a la que pertenece el token.
   * Permite revocar un dispositivo concreto al cerrar sesion, sin invalidar
   * las sesiones abiertas en otros equipos.
   */
  sid: string;
  /** Emitido en (segundos epoch). */
  iat?: number;
  /** Expira en (segundos epoch). */
  exp?: number;
}

/**
 * Payload del refresh token. Comparte forma con el access token: lo que los
 * diferencia es el secreto de firma y su vigencia, no su contenido.
 */
export type RefreshTokenPayload = AccessTokenPayload;

/**
 * Integrante del equipo de soporte con su carga de trabajo.
 *
 * En esta fase el equipo son los usuarios con rol ADMIN. Cuando exista una
 * entidad propia de tecnicos, este contrato no tendra que cambiar.
 */
export interface SupportAgent {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  status: UserStatus;
  lastLoginAt: string | null;
  workload: {
    /** Tickets asignados en estados abiertos. */
    open: number;
    /** De los abiertos, cuantos son criticos. */
    critical: number;
    /** Resueltos o cerrados por esta persona en los ultimos 30 dias. */
    resolvedLast30Days: number;
    /** Total historico asignado. */
    total: number;
  };
}
