import { AlertTriangleIcon, InboxIcon, type LucideIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { Button } from '../components/button';
import { cn } from '../lib/utils';

export interface EmptyStateProps extends ComponentProps<'div'> {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Accion primaria opcional (por ejemplo "Crear ticket"). */
  action?: ReactNode;
}

/**
 * Estado vacio.
 *
 * Toda coleccion sin resultados debe renderizar este componente en lugar de
 * dejar el area en blanco: explica el porque y ofrece la siguiente accion.
 */
export function EmptyState({
  icon: Icon = InboxIcon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-14 text-center',
        className,
      )}
      {...props}
    >
      <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-muted/60 text-muted-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export interface ErrorStateProps extends ComponentProps<'div'> {
  title?: string;
  description?: string;
  /** Handler de reintento; si se omite, no se muestra el boton. */
  onRetry?: () => void;
  retryLabel?: string;
}

/**
 * Estado de error recuperable.
 * Nunca muestra trazas ni detalles internos: solo un mensaje accionable.
 */
export function ErrorState({
  title = 'No pudimos cargar la informacion',
  description = 'Ocurrio un problema al comunicarnos con el servidor. Intentalo nuevamente.',
  onRetry,
  retryLabel = 'Reintentar',
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      data-slot="error-state"
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-14 text-center',
        className,
      )}
      {...props}
    >
      <span className="flex size-11 items-center justify-center rounded-xl border border-destructive/25 bg-destructive/8 text-destructive">
        <AlertTriangleIcon className="size-5" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
