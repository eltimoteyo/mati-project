'use client';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps, ReactNode } from 'react';

import { ButtonLoader } from '../feedback/loaders';
import { cn } from '../lib/utils';

const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap',
    'rounded-md text-sm font-medium select-none',
    'transition-[color,background-color,border-color,box-shadow,transform,opacity]',
    'duration-200 ease-[var(--ease-out-quint)]',
    'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/28',
    'disabled:pointer-events-none disabled:opacity-50',
    'active:scale-[0.985] motion-reduce:active:scale-100',
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-subtle hover:bg-brand-700',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-accent',
        outline:
          'border border-input bg-card text-foreground shadow-subtle hover:bg-accent hover:text-accent-foreground',
        ghost: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        destructive:
          'bg-destructive text-destructive-foreground shadow-subtle hover:brightness-95 focus-visible:ring-destructive/28',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 gap-1.5 px-3 text-[0.8125rem]',
        default: 'h-9.5 px-4',
        lg: 'h-11 px-6 text-[0.9375rem]',
        icon: 'size-9.5',
        'icon-sm': 'size-8',
      },
      block: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  /** Renderiza el hijo como elemento raiz (util para `<Link>`). */
  asChild?: boolean;
  /** Muestra el spinner y bloquea la interaccion. */
  loading?: boolean;
  /** Texto opcional mientras `loading` esta activo. */
  loadingText?: ReactNode;
}

/**
 * Boton del sistema.
 *
 * El estado de carga es parte del componente (no del consumidor) para que
 * todas las acciones asincronas del panel den el mismo feedback visual.
 */
export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  loading = false,
  loadingText,
  disabled,
  children,
  ...props
}: ButtonProps) {
  // `asChild` delega el render al hijo; en ese caso el spinner lo controla
  // el consumidor, porque no podemos inyectar nodos dentro de un Slot unico.
  if (asChild) {
    return (
      <Slot
        data-slot="button"
        className={cn(buttonVariants({ variant, size, block, className }))}
        {...props}
      >
        {children}
      </Slot>
    );
  }

  return (
    <button
      data-slot="button"
      data-loading={loading || undefined}
      className={cn(buttonVariants({ variant, size, block, className }))}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <ButtonLoader /> : null}
      {loading && loadingText ? loadingText : children}
    </button>
  );
}

export { buttonVariants };
