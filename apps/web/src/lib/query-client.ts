import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './api-error';

/** Codigos HTTP en los que reintentar no tiene sentido. */
const NON_RETRYABLE_STATUS = new Set([400, 401, 403, 404, 409, 422]);

/**
 * Crea el cliente de consultas.
 *
 * Se expone como fabrica (no como instancia unica de modulo) porque en el
 * App Router cada peticion del servidor necesita su propio cliente; compartir
 * uno filtraria datos entre usuarios.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Evita refetches inmediatos al montar y al volver a la pestana.
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry(failureCount, error) {
          if (error instanceof ApiError && NON_RETRYABLE_STATUS.has(error.status)) {
            return false;
          }

          return failureCount < 2;
        },
      },
      mutations: {
        // Una mutacion fallida no se repite en silencio: la decision es del
        // usuario, que ve el aviso de error y vuelve a intentarlo.
        retry: false,
      },
    },
  });
}
