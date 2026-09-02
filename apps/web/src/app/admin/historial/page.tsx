import type { Metadata } from 'next';

import { AuditView } from '@/components/audit/audit-view';

export const metadata: Metadata = {
  title: 'Historial',
  description: 'Registro de auditoria cronologico de todos los cambios sobre los tickets.',
};

export default function HistorialPage() {
  return <AuditView />;
}
