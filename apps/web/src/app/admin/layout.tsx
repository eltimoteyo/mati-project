import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AuthGuard } from '@/components/auth/auth-guard';
import { AdminShell } from '@/components/layout/admin-shell';

export const metadata: Metadata = {
  title: {
    default: 'Panel',
    template: '%s · CONIT Support',
  },
};

/**
 * Layout del panel administrativo.
 *
 * `AuthGuard` envuelve todo el arbol: ninguna pagina de `/admin` llega a
 * renderizarse sin una sesion valida confirmada contra la API.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <AdminShell>{children}</AdminShell>
    </AuthGuard>
  );
}
