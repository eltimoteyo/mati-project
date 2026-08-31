import type { Metadata } from 'next';

import { ModulePlaceholder } from '@/components/common/module-placeholder';

export const metadata: Metadata = {
  title: 'Notificaciones',
};

const SCOPE = [
  'Avisos en la aplicacion y por correo electronico.',
  'Preferencias por tipo de evento.',
  'Plantillas de correo corporativo.',
];

export default function NotificacionesPage() {
  return <ModulePlaceholder href="/admin/notificaciones" scope={SCOPE} />;
}
