import type { Metadata } from 'next';

import { ModulePlaceholder } from '@/components/common/module-placeholder';

export const metadata: Metadata = {
  title: 'Base de conocimiento',
};

const SCOPE = [
  'Articulos y soluciones para incidencias frecuentes.',
  'Busqueda y organizacion por categoria.',
  'Vinculacion de articulos a tickets resueltos.',
];

export default function BaseConocimientoPage() {
  return <ModulePlaceholder href="/admin/base-conocimiento" scope={SCOPE} />;
}
