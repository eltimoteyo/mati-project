import type { Metadata } from 'next';
import { Suspense } from 'react';

import { TicketsView } from '@/components/tickets/tickets-view';

export const metadata: Metadata = {
  title: 'Tickets',
  description: 'Registro, seguimiento y resolucion de incidencias.',
};

export default function TicketsPage() {
  // `TicketsView` lee los filtros de la URL con `useSearchParams`, que Next
  // exige envolver en un limite de suspense para poder prerenderizar la ruta.
  return (
    <Suspense fallback={null}>
      <TicketsView />
    </Suspense>
  );
}
