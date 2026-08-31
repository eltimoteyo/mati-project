'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

import { createQueryClient } from '@/lib/query-client';

/**
 * Proveedor de TanStack Query.
 *
 * El cliente se crea con `useState` (no a nivel de modulo) para que cada
 * arbol de React tenga el suyo: en el servidor eso evita compartir cache
 * entre peticiones de usuarios distintos.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
