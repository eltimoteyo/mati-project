import type { Metadata } from 'next';

import { ConversationsView } from '@/components/conversations/conversations-view';

export const metadata: Metadata = {
  title: 'Conversaciones',
  description: 'Hilos de atencion con los clientes, ordenados por actividad reciente.',
};

export default function ConversacionesPage() {
  return <ConversationsView />;
}
