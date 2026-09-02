import { API_ERROR_CODES, type ApiResponse } from '@conit/types';

import { ApiError } from './api-error';
import { env } from './env';

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** Cuerpo en objeto plano; se serializa a JSON automaticamente. */
  body?: unknown;
  /**
   * Desactiva el reintento con refresco. Obligatorio en los propios endpoints
   * de autenticacion para no entrar en un bucle de refrescos.
   */
  skipAuthRefresh?: boolean;
}

/** Ruta del endpoint de refresco, relativa a la base de la API. */
const REFRESH_PATH = '/auth/refresh';

/**
 * Refresco en curso.
 *
 * Si varias peticiones reciben 401 a la vez, todas esperan al mismo refresco
 * en lugar de dispararlo N veces (lo que rotaria el token N veces y activaria
 * la deteccion de reutilizacion del backend).
 */
let inFlightRefresh: Promise<boolean> | null = null;

/** Se emite cuando la sesion deja de ser recuperable. */
export const SESSION_EXPIRED_EVENT = 'conit:session-expired';

function notifySessionExpired(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
}

async function performRequest(path: string, options: RequestOptions): Promise<Response> {
  const { body, skipAuthRefresh: _skipAuthRefresh, headers, ...rest } = options;

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  try {
    return await fetch(`${env.apiUrl}${path}`, {
      ...rest,
      // Imprescindible: los tokens viajan en cookies httpOnly.
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && !isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      ...(body !== undefined
        ? { body: isFormData ? (body as FormData) : JSON.stringify(body) }
        : {}),
    });
  } catch {
    // `fetch` solo rechaza ante fallos de red, no ante codigos HTTP de error.
    throw ApiError.network();
  }
}

/** Traduce la respuesta HTTP al contrato de la API o lanza `ApiError`. */
async function parseResponse<TData>(response: Response): Promise<TData> {
  if (response.status === 204) {
    return null as TData;
  }

  let payload: ApiResponse<TData> | null = null;

  try {
    payload = (await response.json()) as ApiResponse<TData>;
  } catch {
    payload = null;
  }

  if (!payload) {
    throw new ApiError(
      'La respuesta del servidor no tiene el formato esperado.',
      API_ERROR_CODES.INTERNAL_SERVER_ERROR,
      response.status,
    );
  }

  if (!payload.success) {
    throw new ApiError(payload.message, payload.error, response.status, payload.details);
  }

  return payload.data;
}

/** Intenta renovar la sesion. Devuelve `true` si el refresco tuvo exito. */
async function refreshSession(): Promise<boolean> {
  inFlightRefresh ??= (async () => {
    try {
      const response = await performRequest(REFRESH_PATH, {
        method: 'POST',
        skipAuthRefresh: true,
      });

      return response.ok;
    } catch {
      return false;
    } finally {
      // Se libera en el siguiente tick para que las peticiones que llegaron
      // durante el refresco compartan este mismo resultado.
      queueMicrotask(() => {
        inFlightRefresh = null;
      });
    }
  })();

  return inFlightRefresh;
}

/**
 * Cliente HTTP de la aplicacion.
 *
 * Es el unico punto que habla con la API: ningun componente llama a `fetch`
 * directamente. Centraliza credenciales, formato de error y el refresco
 * transparente de la sesion.
 */
async function request<TData>(path: string, options: RequestOptions = {}): Promise<TData> {
  const response = await performRequest(path, options);

  if (response.status !== 401 || options.skipAuthRefresh) {
    return parseResponse<TData>(response);
  }

  // El access token pudo simplemente caducar: se intenta renovar una vez.
  const refreshed = await refreshSession();

  if (!refreshed) {
    notifySessionExpired();

    return parseResponse<TData>(response);
  }

  const retried = await performRequest(path, options);

  return parseResponse<TData>(retried);
}

/**
 * Peticion cruda, sin interpretar el cuerpo.
 *
 * Necesaria para las descargas: un CSV no viene envuelto en el sobre JSON.
 * Comparte el reintento con refresco para que exportar con la sesion recien
 * caducada no falle sin motivo.
 */
async function requestRaw(path: string, options: RequestOptions = {}): Promise<Response> {
  const response = await performRequest(path, options);

  if (response.status !== 401 || options.skipAuthRefresh) {
    return response;
  }

  const refreshed = await refreshSession();

  if (!refreshed) {
    notifySessionExpired();

    return response;
  }

  return performRequest(path, options);
}

export const apiClient = {
  get: <TData>(path: string, options?: RequestOptions) =>
    request<TData>(path, { ...options, method: 'GET' }),

  /** Descarga un fichero. Lanza `ApiError` si el servidor responde con error. */
  async getBlob(path: string, options?: RequestOptions): Promise<Blob> {
    const response = await requestRaw(path, { ...options, method: 'GET' });

    if (!response.ok) {
      throw new ApiError(
        'No se pudo generar el fichero.',
        API_ERROR_CODES.INTERNAL_SERVER_ERROR,
        response.status,
      );
    }

    return response.blob();
  },

  post: <TData>(path: string, body?: unknown, options?: RequestOptions) =>
    request<TData>(path, { ...options, method: 'POST', body }),

  patch: <TData>(path: string, body?: unknown, options?: RequestOptions) =>
    request<TData>(path, { ...options, method: 'PATCH', body }),

  put: <TData>(path: string, body?: unknown, options?: RequestOptions) =>
    request<TData>(path, { ...options, method: 'PUT', body }),

  delete: <TData>(path: string, options?: RequestOptions) =>
    request<TData>(path, { ...options, method: 'DELETE' }),
};
