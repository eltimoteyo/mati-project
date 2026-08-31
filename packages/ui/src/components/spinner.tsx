import type { ComponentProps } from 'react';

import { cn } from '../lib/utils';

const SIZES = {
  xs: 'size-3 border-[1.5px]',
  sm: 'size-4 border-2',
  md: 'size-5 border-2',
  lg: 'size-8 border-[2.5px]',
} as const;

export interface SpinnerProps extends ComponentProps<'span'> {
  size?: keyof typeof SIZES;
  /**
   * Texto anunciado por lectores de pantalla. Se oculta visualmente.
   * Pasa `null` cuando el spinner acompana a un texto ya descriptivo.
   */
  label?: string | null;
}

/**
 * Indicador de carga circular minimo.
 *
 * Base de todos los estados de carga del sistema: se compone dentro de
 * botones, tablas y pantallas completas en lugar de duplicar animaciones.
 */
export function Spinner({ size = 'sm', label = 'Cargando', className, ...props }: SpinnerProps) {
  return (
    <span
      data-slot="spinner"
      role={label ? 'status' : undefined}
      aria-live={label ? 'polite' : undefined}
      className={cn('inline-flex shrink-0 items-center justify-center', className)}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          'animate-spin rounded-full border-current border-t-transparent motion-reduce:animate-none',
          SIZES[size],
        )}
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
