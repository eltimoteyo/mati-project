'use client';

import type { ComponentProps } from 'react';

import { cn } from '../lib/utils';

export interface InputProps extends ComponentProps<'input'> {
  /** Marca visualmente el campo como invalido y lo expone a lectores de pantalla. */
  invalid?: boolean;
}

/**
 * Campo de texto del sistema.
 *
 * El estado invalido se pasa por prop (no por clases sueltas) para que todos
 * los formularios muestren exactamente el mismo tratamiento de error.
 */
export function Input({ className, type = 'text', invalid, ...props }: InputProps) {
  return (
    <input
      data-slot="input"
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(
        'flex h-9.5 w-full min-w-0 rounded-md border border-input bg-card px-3 py-1 text-sm',
        'shadow-subtle transition-[color,border-color,box-shadow] duration-200',
        'placeholder:text-muted-foreground/70',
        'file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/22',
        'disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-55',
        'aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/22',
        className,
      )}
      {...props}
    />
  );
}
