'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { XIcon } from 'lucide-react';
import type { ComponentProps } from 'react';

import { cn } from '../lib/utils';

/**
 * Panel deslizante. Se usa como navegacion movil del panel administrativo.
 * Construido sobre Dialog de Radix, por lo que hereda foco atrapado,
 * cierre con `Escape` y bloqueo de scroll de fondo.
 */
export function Sheet(props: ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />;
}

export function SheetTrigger(props: ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

export function SheetClose(props: ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="sheet-close" {...props} />;
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn('text-sm font-semibold text-foreground', className)}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export interface SheetContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  side?: 'left' | 'right';
  /** Oculta el boton de cierre por defecto (util con cabeceras propias). */
  hideClose?: boolean;
}

export function SheetContent({
  className,
  children,
  side = 'left',
  hideClose = false,
  ...props
}: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="sheet-overlay"
        className={cn(
          'fixed inset-0 z-50 bg-foreground/25 backdrop-blur-[2px]',
          'data-[state=open]:animate-[var(--animate-fade-in)]',
        )}
      />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          'fixed inset-y-0 z-50 flex w-[17.5rem] max-w-[85vw] flex-col bg-sidebar',
          'transition-transform duration-300 ease-[var(--ease-out-quint)]',
          side === 'left' &&
            'left-0 border-r border-sidebar-border data-[state=closed]:-translate-x-full',
          side === 'right' &&
            'right-0 border-l border-sidebar-border data-[state=closed]:translate-x-full',
          className,
        )}
        {...props}
      >
        {children}
        {hideClose ? null : (
          <DialogPrimitive.Close
            className={cn(
              'absolute top-4 right-4 rounded-md p-1 text-muted-foreground',
              'transition-colors hover:bg-sidebar-accent hover:text-foreground',
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
