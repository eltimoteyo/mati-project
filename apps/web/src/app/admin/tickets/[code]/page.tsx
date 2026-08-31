import type { Metadata } from 'next';

import { TicketDetailView } from '@/components/tickets/ticket-detail-view';

interface TicketPageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: TicketPageProps): Promise<Metadata> {
  const { code } = await params;

  return {
    title: decodeURIComponent(code).toUpperCase(),
    description: 'Detalle de la incidencia, gestion e historial de cambios.',
  };
}

export default async function TicketDetailPage({ params }: TicketPageProps) {
  const { code } = await params;

  return <TicketDetailView code={decodeURIComponent(code)} />;
}
