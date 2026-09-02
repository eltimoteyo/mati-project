import type { Metadata } from 'next';

import { NotificationsView } from '@/components/notifications/notifications-view';

export const metadata: Metadata = {
  title: 'Notificaciones',
  description: 'Avisos sobre tickets y conversaciones, y preferencias de aviso.',
};

export default function NotificacionesPage() {
  return <NotificationsView />;
}
