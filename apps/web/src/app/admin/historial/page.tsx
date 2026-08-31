import type { Metadata } from 'next';

import { AuditView } from '@/components/audit/audit-view';

export const metadata: Metadata = {
  title: 'Historial de Auditoría',
  description: 'Registro de auditoría cronológico de todos los cambios sobre los tickets.',
};

export default function HistorialPage() {
  return <AuditView />;
}
