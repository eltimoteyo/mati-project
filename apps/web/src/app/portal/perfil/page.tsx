import type { Metadata } from 'next';

import { SettingsView } from '@/components/settings/settings-view';

export const metadata: Metadata = {
  title: 'Mi perfil',
  description: 'Datos personales y seguridad de tu cuenta de cliente.',
};

export default function PortalProfilePage() {
  return <SettingsView portal />;
}
