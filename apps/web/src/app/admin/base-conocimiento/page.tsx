import type { Metadata } from 'next';

import { KnowledgeView } from '@/components/knowledge/knowledge-view';

export const metadata: Metadata = {
  title: 'Base de conocimiento',
  description: 'Guias, soluciones y procedimientos para resolver incidencias frecuentes.',
};

export default function BaseConocimientoPage() {
  return <KnowledgeView />;
}
