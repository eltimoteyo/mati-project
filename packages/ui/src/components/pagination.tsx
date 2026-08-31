'use client';

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import { cn } from '../lib/utils';
import { Button } from './button';

export interface PaginationMetaLike {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface PaginationProps {
  meta: PaginationMetaLike;
  onPageChange: (page: number) => void;
  /** Nombre del elemento en plural, para el resumen ("clientes", "tickets"). */
  itemLabel?: string;
  className?: string;
}

/**
 * Controles de paginacion.
 *
 * Muestra el rango visible ademas de los botones: en un listado largo, saber
 * "21-40 de 137" orienta mucho mas que un simple numero de pagina.
 */
export function Pagination({
  meta,
  onPageChange,
  itemLabel = 'registros',
  className,
}: PaginationProps) {
  if (meta.total === 0) return null;

  const from = (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.page * meta.pageSize, meta.total);

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-between gap-3 sm:flex-row',
        className,
      )}
    >
      <p className="text-xs text-muted-foreground">
        <span className="tabular font-medium text-foreground">
          {from}–{to}
        </span>{' '}
        de <span className="tabular font-medium text-foreground">{meta.total}</span> {itemLabel}
      </p>

      {meta.totalPages > 1 ? (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!meta.hasPreviousPage}
            onClick={() => onPageChange(meta.page - 1)}
          >
            <ChevronLeftIcon />
            Anterior
          </Button>

          <span className="tabular px-1 text-xs text-muted-foreground">
            {meta.page} / {meta.totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={!meta.hasNextPage}
            onClick={() => onPageChange(meta.page + 1)}
          >
            Siguiente
            <ChevronRightIcon />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
