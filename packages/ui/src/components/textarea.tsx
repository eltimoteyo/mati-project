'use client';

import type { ComponentProps } from 'react';

import { cn } from '../lib/utils';

export interface TextareaProps extends ComponentProps<'textarea'> {
  /** Marca visualmente el campo como invalido y lo expone a lectores de pantalla. */
  invalid?: boolean;
}

/**
 * Area de texto multilinea.
 *
 * Comparte exactamente el mismo tratamiento visual y de foco que `Input`, de
 * modo que un formulario mixto no muestre dos lenguajes distintos.
 */
export function Textarea({ className, invalid, rows = 4, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        'flex w-full min-w-0 resize-y rounded-md border border-input bg-card px-3 py-2 text-sm',
        'shadow-subtle transition-[color,border-color,box-shadow] duration-200',
        'placeholder:text-muted-foreground/70',
        'outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/22',
        'disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-55',
        'aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/22',
        className,
      )}
      {...props}
    />
  );
}
