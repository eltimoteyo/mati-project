import type { ReactNode } from 'react';

import { Header } from './header';
import { Sidebar } from './sidebar';

/**
 * Estructura del panel administrativo.
 *
 * La barra lateral es fija a partir del punto de corte `lg`; por debajo se
 * convierte en panel deslizante y el contenido pasa a ocupar todo el ancho.
 * El desplazamiento es unico (el del documento), de modo que en movil la
 * pagina se comporta como cualquier otra y no aparecen scrolls anidados.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <Sidebar />

      <div className="flex min-h-dvh flex-col lg:pl-64">
        <Header />

        <main id="contenido" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
