import type { Metadata } from 'next';

import { ReportsView } from '@/components/reports/reports-view';

export const metadata: Metadata = {
  title: 'Reportes',
  description: 'Volumen de tickets, tiempos de atencion y cumplimiento de objetivos.',
};

export default function ReportesPage() {
  return <ReportsView />;
}
