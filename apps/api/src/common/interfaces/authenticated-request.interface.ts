import type { UserRole } from '@conit/types';
import type { Request } from 'express';

/**
 * Usuario resuelto por la estrategia JWT y adjuntado a la peticion.
 * Contiene solo lo necesario para autorizar; los datos completos se
 * consultan explicitamente desde `UsersService` cuando hacen falta.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  /** Sesion de refresco asociada; permite cerrar sesion en este dispositivo. */
  sessionId: string;
}

/** Peticion ya autenticada por `JwtAuthGuard`. */
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

/**
 * Peticion del endpoint de refresco: incluye ademas el token en claro para
 * poder contrastarlo con la huella almacenada en la sesion.
 */
export interface RefreshRequest extends Request {
  user: AuthenticatedUser & { refreshToken: string };
}
