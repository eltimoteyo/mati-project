import type { PublicUser } from './user';

/** Credenciales enviadas al endpoint de login. */
export interface LoginRequest {
  email: string;
  password: string;
  /** Extiende la vigencia del refresh token. */
  rememberMe?: boolean;
}

/**
 * Resultado del login.
 *
 * Los tokens NO viajan en el cuerpo: se emiten como cookies `httpOnly`
 * para que JavaScript del navegador no pueda leerlos (mitigacion de XSS).
 */
export interface LoginResponse {
  user: PublicUser;
  /** Vigencia del access token en segundos, util para programar el refresco. */
  expiresIn: number;
}

/** Resultado de `GET /auth/me`. */
export interface SessionResponse {
  user: PublicUser;
}

/** Resultado de `POST /auth/refresh`. */
export interface RefreshResponse {
  user: PublicUser;
  expiresIn: number;
}
