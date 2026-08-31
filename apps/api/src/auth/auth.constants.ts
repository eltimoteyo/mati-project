/** Nombres de las estrategias Passport registradas por el modulo de auth. */
export const AUTH_STRATEGIES = {
  jwt: 'jwt',
  jwtRefresh: 'jwt-refresh',
} as const;

/**
 * Mensajes de autenticacion.
 *
 * `invalidCredentials` es deliberadamente ambiguo: no revela si el fallo fue
 * por correo inexistente o por contrasena incorrecta, para no facilitar la
 * enumeracion de cuentas.
 */
export const AUTH_MESSAGES = {
  invalidCredentials: 'Credenciales incorrectas',
  inactiveAccount: 'Tu cuenta esta inactiva. Contacta con el administrador.',
  sessionExpired: 'Tu sesion expiro. Inicia sesion nuevamente.',
  sessionInvalid: 'Sesion inexistente o invalida',
  loginSuccess: 'Inicio de sesion exitoso',
  logoutSuccess: 'Sesion cerrada correctamente',
  refreshSuccess: 'Sesion renovada correctamente',
  passwordChanged: 'Contrasena actualizada correctamente',
  tooManyAttempts:
    'Demasiados intentos de inicio de sesion. Espera un momento e intentalo de nuevo.',
} as const;

/**
 * Limite de intentos de inicio de sesion por ventana de tiempo.
 *
 * Es una constante de seguridad y no una variable de entorno a proposito:
 * relajarla por configuracion en un despliegue concreto abriria la puerta a
 * ataques de fuerza bruta sin dejar rastro en el codigo.
 */
export const LOGIN_RATE_LIMIT = {
  limit: 5,
  ttl: 60_000,
} as const;

/**
 * Parametros Argon2id alineados con la recomendacion de OWASP
 * (m = 19 MiB, t = 2, p = 1).
 */
export const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;
