'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { XIcon } from 'lucide-react';
import type { ComponentProps } from 'react';

import { cn } from '../lib/utils';

/**
 * Dialogo modal centrado.
 *
 * Se usa para los formularios de alta y edicion. Comparte primitiva con
 * `Sheet` pero se presenta centrado, que es lo apropiado para un formulario
 * corto: el panel deslizante se reserva para la navegacion.
 */
export function Dialog(props: ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

export function DialogTrigger(props: ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

export function DialogClose(props: ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

export interface DialogContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  /** Oculta el boton de cierre por defecto. */
  hideClose?: boolean;
  size?: 'sm' | 'default' | 'lg';
}

const SIZES = {
  sm: 'sm:max-w-md',
  default: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
} as const;

export function DialogContent({
  className,
  children,
  hideClose = false,
  size = 'default',
  ...props
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        className={cn(
          'fixed inset-0 z-50 bg-foreground/25 backdrop-blur-[2px]',
          'data-[state=open]:animate-[var(--animate-fade-in)]',
        )}
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'fixed top-1/2 left-1/2 z-50 flex w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
          'max-h-[calc(100dvh-3rem)] flex-col overflow-hidden rounded-xl border border-border',
          'bg-card shadow-overlay data-[state=open]:animate-[var(--animate-rise)]',
          SIZES[size],
          className,
        )}
        {...props}
      >
        {children}

        {hideClose ? null : (
          <DialogPrimitive.Close
            className={cn(
              'absolute top-4 right-4 rounded-md p-1 text-muted-foreground',
              'transition-colors hover:bg-accent hover:text-foreground',
              'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/22',
            )}
          >
            <XIcon className="size-4" />
            <span className="sr-only">Cerrar</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-1.5 border-b border-border px-6 py-4 pr-12', className)}
      {...props}
    />
  );
}

/** Cuerpo desplazable: mantiene cabecera y pie siempre visibles. */
export function DialogBody({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-body"
      className={cn('flex-1 overflow-y-auto px-6 py-5', className)}
      {...props}
    />
  );
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'flex flex-col-reverse gap-2 border-t border-border px-6 py-4 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-base font-semibold tracking-[-0.01em]', className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}
