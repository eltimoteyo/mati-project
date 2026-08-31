/**
 * Contrato de respuesta de la API de CONIT Support.
 *
 * Todas las respuestas (exito y error) comparten la misma envoltura para que
 * el frontend pueda tratarlas de forma uniforme sin condicionales dispersos.
 */

/** Codigos de error estables que el frontend puede mapear a mensajes o flujos. */
export const API_ERROR_CODES = {
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

/** Respuesta correcta de la API. */
export interface ApiSuccessResponse<TData = unknown> {
  success: true;
  message: string;
  data: TData;
}

/** Respuesta de error de la API. Nunca expone detalles internos del servidor. */
export interface ApiErrorResponse {
  success: false;
  message: string;
  error: ApiErrorCode | string;
  /** Errores por campo, presente solo en fallos de validacion. */
  details?: Record<string, string[]>;
}

export type ApiResponse<TData = unknown> = ApiSuccessResponse<TData> | ApiErrorResponse;

/** Type guard para estrechar una respuesta a su variante de exito. */
export function isApiSuccess<TData>(
  response: ApiResponse<TData>,
): response is ApiSuccessResponse<TData> {
  return response.success === true;
}

/** Metadatos de paginacion reutilizables por los modulos de la Fase 2. */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedData<TItem> {
  items: TItem[];
  meta: PaginationMeta;
}

/** Parametros de consulta estandar para listados paginados. */
export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
