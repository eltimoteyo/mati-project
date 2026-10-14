import type { Metadata } from 'next';

import { InboxView } from '@/components/inbox/inbox-view';

export const metadata: Metadata = {
  title: 'Bandeja',
  description: 'Mensajes de WhatsApp de los clientes, para responder o convertir en ticket.',
};

export default function BandejaPage() {
  return <InboxView />;
}
