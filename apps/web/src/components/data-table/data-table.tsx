'use client';

import { cn, EmptyState, TableSkeleton } from '@conit/ui';
import {
  createColumnHelper,
  type RowData,
  tableFeatures,
  type TableOptions,
  useTable,
} from '@tanstack/react-table';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Conjunto de caracteristicas habilitadas en las tablas del panel.
 *
 * TanStack Table v9 exige declararlas explicitamente; se empieza con el nucleo
 * y en la Fase 2 se anadiran aqui ordenacion, filtrado y paginacion, de una
 * sola vez para todas las tablas del sistema.
 */
export const tableFeatureSet = tableFeatures({});

/** Ayudante de columnas ligado al conjunto de caracteristicas del panel. */
export function createConitColumnHelper<TData extends RowData>() {
  return createColumnHelper<typeof tableFeatureSet, TData>();
}

/**
 * Tipo de la coleccion de columnas.
 *
 * Se deriva de las propias opciones de `useTable` en lugar de reescribirse:
 * asi coincide exactamente con lo que espera TanStack Table (incluida la
 * varianza de `TValue`) y no hace falta recurrir a `any`.
 */
export type ConitColumns<TData extends RowData> = TableOptions<
  typeof tableFeatureSet,
  TData
>['columns'];

interface DataTableProps<TData extends RowData> {
  columns: ConitColumns<TData>;
  data: TData[];
  isLoading?: boolean;
  /** Titulo del estado vacio. */
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: LucideIcon;
  emptyAction?: ReactNode;
  className?: string;
}

/**
 * Tabla de datos del panel.
 *
 * Encapsula los tres estados que toda coleccion debe cubrir —cargando, vacia
 * y con datos— para que ninguna vista tenga que reimplementarlos. Es la base
 * de los listados de tickets, clientes y servicios de la Fase 2.
 */
export function DataTable<TData extends RowData>({
  columns,
  data,
  isLoading = false,
  emptyTitle = 'No hay registros',
  emptyDescription = 'Cuando existan datos apareceran en esta tabla.',
  emptyIcon,
  emptyAction,
  className,
}: DataTableProps<TData>) {
  const table = useTable({
    features: tableFeatureSet,
    columns,
    data,
  });

  if (isLoading) {
    return <TableSkeleton columns={columns.length} className={className} />;
  }

  const rows = table.getRowModel().rows;

  if (rows.length === 0) {
    return (
      <div className={cn('rounded-lg border border-border', className)}>
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          {...(emptyIcon ? { icon: emptyIcon } : {})}
          {...(emptyAction ? { action: emptyAction } : {})}
        />
      </div>
    );
  }

  return (
    // El contenedor desplaza horizontalmente en pantallas estrechas en lugar
    // de forzar el scroll de toda la pagina.
    <div className={cn('overflow-x-auto rounded-lg border border-border', className)}>
      <table className="w-full min-w-[44rem] border-collapse text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b border-border bg-muted/40">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  colSpan={header.colSpan}
                  scope="col"
                  className="px-5 py-3 text-left text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase"
                >
                  {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                </th>
              ))}
            </tr>
          ))}
        </thead>

        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.id} className="transition-colors hover:bg-muted/35">
              {row.getAllCells().map((cell) => (
                <td key={cell.id} className="px-5 py-3.5 align-middle">
                  <table.FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
