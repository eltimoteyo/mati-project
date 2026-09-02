import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { PortalGuard } from '@/components/auth/auth-guard';
import { PortalShell } from '@/components/portal/portal-shell';

export const metadata: Metadata = {
  title: {
    default: 'Portal',
    template: '%s · Portal CONIT',
  },
  // Area privada: no debe indexarse.
  robots: { index: false, follow: false },
};

/**
 * Layout del portal del cliente.
 *
 * `PortalGuard` exige rol CLIENT: si entra alguien del equipo, se le lleva al
 * panel en lugar de mostrarle un area que no le corresponde.
 */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <PortalGuard>
      <PortalShell>{children}</PortalShell>
    </PortalGuard>
  );
}
