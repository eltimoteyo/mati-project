import type { Metadata } from 'next';

import { SupportTeamView } from '@/components/support/support-team-view';

export const metadata: Metadata = {
  title: 'Encargado de soporte',
  description: 'Reparto de la carga de trabajo entre el equipo de soporte.',
};

export default function SoportePage() {
  return <SupportTeamView />;
}
