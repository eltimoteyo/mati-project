import type { Metadata } from 'next';

import { DashboardView } from '@/components/dashboard/dashboard-view';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Vision general de la actividad de soporte de CONIT.',
};

export default function DashboardPage() {
  return <DashboardView />;
}
