import type { Metadata } from 'next';

import { ModulePlaceholder } from '@/components/common/module-placeholder';

export const metadata: Metadata = {
  title: 'Reportes',
};

const SCOPE = [
  'Volumen de tickets por periodo, cliente y servicio.',
  'Tiempos medios de primera respuesta y de resolucion.',
  'Exportacion de resultados.',
];

export default function ReportesPage() {
  return <ModulePlaceholder href="/admin/reportes" scope={SCOPE} />;
}
