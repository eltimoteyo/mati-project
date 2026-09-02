import type { Metadata } from 'next';

import { PortalHome } from '@/components/portal/portal-home';

export const metadata: Metadata = {
  title: 'Inicio',
  description: 'Resumen de tus incidencias y datos de contacto.',
};

export default function PortalPage() {
  return <PortalHome />;
}
