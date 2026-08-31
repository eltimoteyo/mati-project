'use client';

import type { ComponentProps } from 'react';

import { Spinner } from '../components/spinner';
import { cn } from '../lib/utils';

/**
 * Indicador de carga para acciones dentro de un boton.
 * Se usa internamente por `<Button loading />` y esta disponible para
 * controles personalizados que necesiten el mismo lenguaje visual.
 */
export function ButtonLoader({ className, ...props }: ComponentProps<'span'>) {
  return <Spinner size="sm" label={null} className={cn(className)} {...props} />;
}

export interface PageLoaderProps extends ComponentProps<'div'> {
  /** Mensaje bajo el indicador. */
  message?: string;
  /** Ocupa toda la ventana en lugar del contenedor padre. */
  fullscreen?: boolean;
}

/**
 * Estado de carga de pantalla completa.
 *
 * Se usa mientras se resuelve la sesion o al navegar entre secciones del
 * panel: el logo pulsante evita el "salto en blanco" entre rutas.
 */
export function PageLoader({
  message = 'Cargando…',
  fullscreen = false,
  className,
  ...props
}: PageLoaderProps) {
  return (
    <div
      data-slot="page-loader"
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center gap-4',
        fullscreen ? 'fixed inset-0 z-50 bg-background' : 'min-h-[18rem] w-full',
        className,
      )}
      {...props}
    >
      <span className="relative flex size-10 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-xl bg-primary/15 motion-reduce:animate-none" />
        <span className="relative flex size-10 items-center justify-center rounded-xl border border-border bg-card text-primary">
          <Spinner size="sm" label={null} />
        </span>
      </span>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/** Carga en linea, para secciones que no ocupan la pantalla completa. */
export function InlineLoader({
  message = 'Cargando…',
  className,
  ...props
}: ComponentProps<'div'> & { message?: string }) {
  return (
    <div
      data-slot="inline-loader"
      role="status"
      aria-live="polite"
      className={cn('flex items-center gap-2.5 text-sm text-muted-foreground', className)}
      {...props}
    >
      <Spinner size="sm" label={null} />
      <span>{message}</span>
    </div>
  );
}
