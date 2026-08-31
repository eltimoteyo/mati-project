import type { Metadata } from 'next';

import { ModulePlaceholder } from '@/components/common/module-placeholder';

export const metadata: Metadata = {
  title: 'IA de soporte',
};

const SCOPE = [
  'Clasificacion automatica de tickets entrantes.',
  'Sugerencia de respuesta a partir de la base de conocimiento.',
  'Resumen de conversaciones largas.',
  'Proveedores previstos: OpenRouter, Groq y Gemini.',
];

export default function IaPage() {
  return <ModulePlaceholder href="/admin/ia" scope={SCOPE} />;
}
