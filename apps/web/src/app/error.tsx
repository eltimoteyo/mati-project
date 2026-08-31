'use client';

import { Button } from '@conit/ui';
import { useEffect } from 'react';

import { ConitLogo } from '@/components/brand/conit-logo';

/**
 * Limite de error de la aplicacion.
 *
 * Muestra un mensaje generico: el detalle tecnico se registra en consola pero
 * nunca se presenta al usuario, del mismo modo que hace la API con sus 5xx.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[CONIT Support] Error no controlado:', error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 text-center">
      <ConitLogo size="lg" />

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Ocurrio un error inesperado</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          No pudimos completar la operacion. Puedes reintentar; si el problema persiste, contacta
          con el equipo tecnico.
        </p>
        {error.digest ? (
          <p className="tabular mt-1 text-xs text-muted-foreground/80">
            Referencia: {error.digest}
          </p>
        ) : null}
      </div>

      <Button onClick={reset}>Reintentar</Button>
    </main>
  );
}
