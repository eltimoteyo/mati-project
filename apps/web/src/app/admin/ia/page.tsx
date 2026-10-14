import type { Metadata } from 'next';

import { AiView } from '@/components/ai/ai-view';

export const metadata: Metadata = {
  title: 'Asistente de soporte',
  description:
    'Respuesta automatica por WhatsApp y ayuda para redactar, clasificar y resumir incidencias.',
};

export default function IaPage() {
  return <AiView />;
}
