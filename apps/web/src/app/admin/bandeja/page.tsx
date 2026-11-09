import type { Metadata } from 'next';

import { InboxView } from '@/components/inbox/inbox-view';

export const metadata: Metadata = {
  title: 'Bandeja',
  description: 'Mensajes de WhatsApp de los clientes, para responder o convertir en ticket.',
};

export default async function BandejaPage({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string }>;
}) {
  const { conversation } = await searchParams;
  const selected = conversation && /^[0-9a-f-]{36}$/i.test(conversation) ? conversation : null;
  return <InboxView key={selected} initialConversationId={selected} />;
}
