'use client';

import type { Ticket } from '@conit/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { InboxIcon } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

import { createConitColumnHelper, DataTable } from '@/components/data-table/data-table';
import { CategoryBadge, TicketPriorityBadge, TicketStatusBadge } from '@/components/domain/badges';

const columnHelper = createConitColumnHelper<Ticket>();

interface ActivityTableProps {
  rows: Ticket[];
  isLoading?: boolean;
}

/**
 * Actividad reciente de tickets.
 *
 * Comparte el componente `DataTable` con los listados completos, de modo que
 * el estilo, los estados de carga y los estados vacios sean identicos.
 */
export function ActivityTable({ rows, isLoading = false }: ActivityTableProps) {
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('code', {
          header: 'Ticket',
          cell: (info) => (
            <Link
              href={`/admin/tickets/${info.getValue()}`}
              className="tabular rounded-sm font-mono text-xs font-medium text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/22"
            >
              {info.getValue()}
            </Link>
          ),
        }),
        columnHelper.accessor('subject', {
          header: 'Asunto',
          cell: (info) => (
            <Link
              href={`/admin/tickets/${info.row.original.code}`}
              className="block max-w-[22rem] truncate rounded-sm font-medium text-foreground hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/22"
            >
              {info.getValue()}
            </Link>
          ),
        }),
        columnHelper.accessor((row) => row.client.name, {
          id: 'client',
          header: 'Cliente',
          cell: (info) => (
            <span className="block max-w-[12rem] truncate text-muted-foreground">
              {info.getValue()}
            </span>
          ),
        }),
        columnHelper.accessor((row) => row.category, {
          id: 'category',
          header: 'Categoria',
          cell: (info) => <CategoryBadge category={info.getValue()} />,
        }),
        columnHelper.accessor('priority', {
          header: 'Prioridad',
          cell: (info) => <TicketPriorityBadge priority={info.getValue()} />,
        }),
        columnHelper.accessor('status', {
          header: 'Estado',
          cell: (info) => <TicketStatusBadge status={info.getValue()} />,
        }),
        columnHelper.accessor('updatedAt', {
          header: 'Actualizado',
          cell: (info) => (
            <span className="tabular whitespace-nowrap text-muted-foreground">
              {format(new Date(info.getValue()), 'd MMM, HH:mm', { locale: es })}
            </span>
          ),
        }),
      ]),
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      emptyIcon={InboxIcon}
      emptyTitle="Sin actividad reciente"
      emptyDescription="Cuando se registren tickets, sus ultimos movimientos apareceran aqui."
    />
  );
}
