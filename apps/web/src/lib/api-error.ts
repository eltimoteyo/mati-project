import { API_ERROR_CODES, type ApiErrorCode } from '@conit/types';

/**
 * Error normalizado de la API.
 *
 * Toda la aplicacion trabaja con este tipo: los componentes no necesitan
 * saber si el fallo vino de un 4xx, de un 5xx o de la red.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode | string;
  readonly status: number;
  readonly details: Record<string, string[]> | undefined;

  constructor(
    message: string,
    code: ApiErrorCode | string,
    status: number,
    details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /** Fallo de red o servidor inalcanzable. */
  static network(): ApiError {
    return new ApiError(
      'No pudimos conectar con el servidor. Revisa tu conexion e intentalo de nuevo.',
      API_ERROR_CODES.SERVICE_UNAVAILABLE,
      0,
    );
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isValidation(): boolean {
    return this.code === API_ERROR_CODES.VALIDATION_ERROR;
  }
}

/** Mensaje presentable de cualquier error, con texto de reserva seguro. */
export function toErrorMessage(error: unknown, fallback = 'Ocurrio un error inesperado'): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;

  return fallback;
}
