import type { Metadata } from 'next';

import { PortalTicketDetail } from '@/components/portal/portal-ticket-detail';

interface PortalTicketPageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: PortalTicketPageProps): Promise<Metadata> {
  const { code } = await params;

  return {
    title: decodeURIComponent(code).toUpperCase(),
    description: 'Estado y seguimiento de tu incidencia.',
  };
}

export default async function PortalTicketPage({ params }: PortalTicketPageProps) {
  const { code } = await params;

  return <PortalTicketDetail code={decodeURIComponent(code)} />;
}
