import type { Metadata } from 'next';

import { CategoriesView } from '@/components/categories/categories-view';

export const metadata: Metadata = {
  title: 'Categorias',
  description: 'Clasificacion de incidencias y tiempos objetivo de atencion.',
};

export default function CategoriasPage() {
  return <CategoriesView />;
}
