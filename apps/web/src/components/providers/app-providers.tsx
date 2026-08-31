'use client';

import { TooltipProvider } from '@conit/ui';
import type { ReactNode } from 'react';

import { QueryProvider } from './query-provider';
import { ThemeProvider } from './theme-provider';
import { Toaster } from './toaster';

/**
 * Proveedores globales de la aplicacion.
 *
 * Se agrupan aqui para que el layout raiz siga siendo un componente de
 * servidor y solo este arbol cruce la frontera hacia el cliente.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
