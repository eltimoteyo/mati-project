import type { Metadata } from 'next';

import { ModulePlaceholder } from '@/components/common/module-placeholder';

export const metadata: Metadata = {
  title: 'Historial',
};

const SCOPE = [
  'Registro de auditoria de cambios sobre cada entidad.',
  'Autor, fecha y valores anteriores de cada modificacion.',
  'Filtrado por usuario, entidad y rango de fechas.',
];

export default function HistorialPage() {
  return <ModulePlaceholder href="/admin/historial" scope={SCOPE} />;
}
