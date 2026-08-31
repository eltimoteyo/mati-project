import type { ComponentProps } from 'react';

import { cn } from '../lib/utils';

export interface SkeletonProps extends ComponentProps<'div'> {
  /** Forma del placeholder. */
  shape?: 'block' | 'text' | 'circle';
}

/**
 * Placeholder de carga.
 *
 * Usa un pulso de opacidad en lugar de un barrido de gradiente: es mas
 * discreto y no compite visualmente con el contenido real que lo sustituye.
 */
export function Skeleton({ className, shape = 'block', ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        'animate-[var(--animate-shimmer)] bg-muted motion-reduce:animate-none',
        shape === 'block' && 'rounded-md',
        shape === 'text' && 'h-3.5 rounded-full',
        shape === 'circle' && 'rounded-full',
        className,
      )}
      {...props}
    />
  );
}
