import type { ReactNode } from 'react';

/**
 * Layout del area publica de autenticacion.
 * Se mantiene deliberadamente vacio de cromo: la pantalla de acceso no debe
 * mostrar navegacion ni ningun dato del sistema.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-background">{children}</div>;
}
