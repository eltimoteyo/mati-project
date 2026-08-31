import type { Metadata } from 'next';

import { ClientsView } from '@/components/clients/clients-view';

export const metadata: Metadata = {
  title: 'Clientes',
  description: 'Empresas y contactos con servicios contratados a CONIT.',
};

export default function ClientesPage() {
  return <ClientsView />;
}
