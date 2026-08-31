'use client';

import { useTheme } from 'next-themes';
import { Toaster as SonnerToaster } from 'sonner';

/**
 * Contenedor de avisos.
 *
 * Se apoya en los tokens del design system en lugar del tema propio de
 * Sonner, de modo que los avisos comparten paleta, radios y bordes con el
 * resto de la interfaz.
 */
export function Toaster() {
  const { resolvedTheme } = useTheme();

  return (
    <SonnerToaster
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      // Abajo a la derecha, no arriba: la cabecera es fija y aloja el
      // conmutador de tema, las notificaciones y el menu de cuenta. Un aviso
      // en la esquina superior derecha se superpone a esos controles y llega a
      // interceptar los clics.
      position="bottom-right"
      closeButton
      richColors={false}
      duration={4_000}
      gap={10}
      toastOptions={{
        classNames: {
          toast:
            'group border border-border bg-popover text-popover-foreground shadow-overlay rounded-lg',
          title: 'text-sm font-medium',
          description: 'text-sm text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground rounded-md text-xs font-medium',
          cancelButton: 'bg-muted text-muted-foreground rounded-md text-xs font-medium',
          closeButton: 'bg-card border-border text-muted-foreground hover:text-foreground',
          success: '[&_[data-icon]]:text-success',
          error: '[&_[data-icon]]:text-destructive',
          warning: '[&_[data-icon]]:text-warning',
          info: '[&_[data-icon]]:text-info',
        },
      }}
    />
  );
}
