import type { Metadata } from 'next';

import { PortalTickets } from '@/components/portal/portal-tickets';

export const metadata: Metadata = {
  title: 'Mis incidencias',
  description: 'Todas tus incidencias reportadas, con su estado actual.',
};

export default function PortalTicketsPage() {
  return <PortalTickets />;
}
