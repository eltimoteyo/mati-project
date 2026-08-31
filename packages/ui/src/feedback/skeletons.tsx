import type { ComponentProps } from 'react';

import { Card, CardContent, CardHeader } from '../components/card';
import { Skeleton } from '../components/skeleton';
import { cn } from '../lib/utils';

export interface TableSkeletonProps extends ComponentProps<'div'> {
  rows?: number;
  columns?: number;
  /** Muestra la fila de encabezado. */
  withHeader?: boolean;
}

/**
 * Esqueleto de tabla.
 *
 * Reproduce la reticula real (encabezado + filas) para que el contenido
 * definitivo no provoque desplazamiento de layout al aparecer.
 */
export function TableSkeleton({
  rows = 6,
  columns = 5,
  withHeader = true,
  className,
  ...props
}: TableSkeletonProps) {
  return (
    <div
      data-slot="table-skeleton"
      aria-hidden="true"
      className={cn('overflow-hidden rounded-lg border border-border', className)}
      {...props}
    >
      {withHeader ? (
        <div
          className="grid gap-4 border-b border-border bg-muted/40 px-5 py-3"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }, (_, index) => (
            <Skeleton key={`head-${index}`} shape="text" className="h-3 w-2/3" />
          ))}
        </div>
      ) : null}

      <div className="divide-y divide-border">
        {Array.from({ length: rows }, (_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="grid gap-4 px-5 py-3.5"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }, (_, colIndex) => (
              <Skeleton
                key={`cell-${rowIndex}-${colIndex}`}
                shape="text"
                className={colIndex === 0 ? 'w-4/5' : 'w-3/5'}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export interface CardSkeletonProps extends ComponentProps<'div'> {
  /** Numero de lineas de texto simuladas en el cuerpo. */
  lines?: number;
  /** Reserva espacio para un icono o avatar en la cabecera. */
  withMedia?: boolean;
}

/** Esqueleto de tarjeta, usado en las metricas del dashboard. */
export function CardSkeleton({
  lines = 2,
  withMedia = true,
  className,
  ...props
}: CardSkeletonProps) {
  return (
    <Card data-slot="card-skeleton" aria-hidden="true" className={cn(className)} {...props}>
      <CardHeader>
        <div className="flex w-full flex-col gap-2">
          <Skeleton shape="text" className="h-3 w-24" />
          <Skeleton className="h-7 w-16" />
        </div>
        {withMedia ? <Skeleton shape="circle" className="size-9" /> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton
            key={`line-${index}`}
            shape="text"
            className={index === lines - 1 ? 'w-1/2' : 'w-full'}
          />
        ))}
      </CardContent>
    </Card>
  );
}

export interface FormLoadingStateProps extends ComponentProps<'div'> {
  fields?: number;
  /** Reserva espacio para el boton de envio. */
  withAction?: boolean;
}

/** Esqueleto de formulario: etiqueta + campo por cada fila. */
export function FormLoadingState({
  fields = 3,
  withAction = true,
  className,
  ...props
}: FormLoadingStateProps) {
  return (
    <div
      data-slot="form-loading-state"
      aria-hidden="true"
      className={cn('flex flex-col gap-5', className)}
      {...props}
    >
      {Array.from({ length: fields }, (_, index) => (
        <div key={`field-${index}`} className="flex flex-col gap-2">
          <Skeleton shape="text" className="h-3 w-28" />
          <Skeleton className="h-9.5 w-full" />
        </div>
      ))}
      {withAction ? <Skeleton className="h-9.5 w-full" /> : null}
    </div>
  );
}

/** Rejilla de esqueletos de tarjeta para listados de metricas. */
export function CardGridSkeleton({
  items = 4,
  className,
  ...props
}: ComponentProps<'div'> & { items?: number }) {
  return (
    <div
      data-slot="card-grid-skeleton"
      className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}
      {...props}
    >
      {Array.from({ length: items }, (_, index) => (
        <CardSkeleton key={`card-${index}`} lines={1} />
      ))}
    </div>
  );
}
