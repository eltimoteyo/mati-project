/** Nombres de las cookies de sesion emitidas por la API. */
export const COOKIE_NAMES = {
  accessToken: 'conit_at',
  refreshToken: 'conit_rt',
} as const;

/**
 * Claves de metadatos usadas por decoradores, guards e interceptores.
 * Se prefijan para no colisionar con metadatos de terceros.
 */
export const METADATA_KEYS = {
  isPublic: 'conit:is-public',
  roles: 'conit:roles',
  responseMessage: 'conit:response-message',
  rawResponse: 'conit:raw-response',
} as const;

/** Mensajes de exito por defecto de la envoltura de respuesta. */
export const DEFAULT_SUCCESS_MESSAGE = 'Operacion realizada correctamente';

/** Mensaje generico ante fallos no controlados: nunca filtra detalles internos. */
export const GENERIC_ERROR_MESSAGE = 'Ocurrio un error inesperado';
