import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { SiteShell } from '@/components/site/site-shell';
import { siteConfig } from '@/config/site';

/**
 * El sitio publico SI debe indexarse.
 *
 * La raiz declara `noindex` porque el panel es privado; aqui se revierte solo
 * para estas paginas, que son la cara externa de la empresa.
 */
export const metadata: Metadata = {
  robots: { index: true, follow: true },
  description: siteConfig.description,
};

/**
 * Layout del sitio publico.
 *
 * Agrupa las paginas de cara al exterior bajo una misma estructura. El panel
 * vive en su propio grupo de rutas y no comparte esta cabecera ni este pie.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
