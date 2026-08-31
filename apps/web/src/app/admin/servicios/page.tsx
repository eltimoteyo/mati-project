import type { Metadata } from 'next';

import { ProjectsView } from '@/components/projects/projects-view';

export const metadata: Metadata = {
  title: 'Proyectos y servicios',
  description: 'Inventario de webs, sistemas, aulas virtuales, hosting, dominios y correo.',
};

export default function ServiciosPage() {
  return <ProjectsView />;
}
