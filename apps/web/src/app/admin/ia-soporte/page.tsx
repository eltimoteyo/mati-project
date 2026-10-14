import type { Metadata } from 'next';

import { CategoriesView } from '@/components/categories/categories-view';

export const metadata: Metadata = {
  title: 'Categorias y SLA',
  description: 'Clasificacion de incidencias y tiempos objetivo de atencion.',
};

export default function IaSoportePage() {
  return <CategoriesView />;
}
