import type { Metadata } from 'next';

import { HomeView } from '@/components/site/home-view';
import { SitePreloader } from '@/components/site/site-preloader';

/**
 * Portada de CONIT.
 *
 * A diferencia del panel, el sitio publico si se indexa: los metadatos de aqui
 * sobreescriben el `robots: noindex` que el layout raiz aplica por defecto.
 */
export const metadata: Metadata = {
  title: 'CONIT · Desarrollo y soporte tecnico',
  description:
    'CONIT desarrolla y mantiene sitios web, sistemas de gestion, aulas virtuales, hosting, ' +
    'dominios, correo corporativo y bases de datos, con soporte tecnico registrado y trazable.',
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    siteName: 'CONIT',
    title: 'CONIT · Desarrollo y soporte tecnico',
    description:
      'Tu tecnologia, atendida por quien la construyo. Sitios web, sistemas, aulas virtuales, ' +
      'hosting, dominios, correo y bases de datos.',
  },
};

export default function HomePage() {
  return (
    <>
      {/* La presentacion solo acompana a la portada: en las paginas interiores
          seria una interrupcion, no una entrada. */}
      <SitePreloader />
      <HomeView />
    </>
  );
}
