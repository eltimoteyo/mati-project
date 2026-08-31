import type { Metadata } from 'next';

import { SettingsView } from '@/components/settings/settings-view';

export const metadata: Metadata = {
  title: 'Configuracion',
  description: 'Datos de tu cuenta, seguridad y preferencias de la interfaz.',
};

export default function ConfiguracionPage() {
  return <SettingsView />;
}
