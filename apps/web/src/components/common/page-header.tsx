import { cn } from '@conit/ui';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Acciones alineadas a la derecha (botones primarios, filtros). */
  actions?: ReactNode;
  className?: string;
}

/**
 * Encabezado de seccion.
 *
 * Unifica la jerarquia tipografica de todas las paginas del panel: un unico
 * `h1` por vista, descripcion opcional y una zona de acciones que se apila
 * bajo el titulo en pantallas pequenas.
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="text-xl font-semibold tracking-[-0.02em] sm:text-2xl">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
