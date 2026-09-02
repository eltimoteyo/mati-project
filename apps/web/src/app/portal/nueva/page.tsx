import type { Metadata } from 'next';

import { PortalNewTicket } from '@/components/portal/portal-new-ticket';

export const metadata: Metadata = {
  title: 'Reportar incidencia',
  description: 'Registra una nueva incidencia para que soporte la atienda.',
};

export default function PortalNewTicketPage() {
  return <PortalNewTicket />;
}
