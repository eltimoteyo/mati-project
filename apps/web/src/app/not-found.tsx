import { Button } from '@conit/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ConitLogo } from '@/components/brand/conit-logo';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Pagina no encontrada',
};

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 text-center">
      <ConitLogo size="lg" />

      <div className="flex flex-col gap-2">
        <p className="tabular text-sm font-medium text-muted-foreground">Error 404</p>
        <h1 className="text-2xl font-semibold">Esta pagina no existe</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Es posible que el enlace haya cambiado o que la seccion aun no este disponible.
        </p>
      </div>

      <Button asChild>
        <Link href={siteConfig.routes.dashboard}>Volver al panel</Link>
      </Button>
    </main>
  );
}
