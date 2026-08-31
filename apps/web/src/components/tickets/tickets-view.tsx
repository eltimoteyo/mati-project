'use client';

import {
  type Ticket,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_STATUSES,
  type TicketPriority,
  type TicketStatus,
} from '@conit/types';
import {
  Button,
  ErrorState,
  Pagination,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@conit/ui';
import { formatDistanceToNowStrict } from 'date-fns';
import { es } from 'date-fns/locale';
import { PlusIcon, TicketIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { DataToolbar } from '@/components/common/data-toolbar';
import { PageHeader } from '@/components/common/page-header';
import { createConitColumnHelper, DataTable } from '@/components/data-table/data-table';
import { CategoryBadge, TicketPriorityBadge, TicketStatusBadge } from '@/components/domain/badges';
import { useIsHydrated } from '@/hooks/use-is-hydrated';
import { useTickets } from '@/hooks/use-tickets';

import { TicketFormDialog } from './ticket-form-dialog';

const columnHelper = createConitColumnHelper<Ticket>();

/**
 * Antiguedad relativa ("hace 3 h").
 *
 * Se calcula solo tras la hidratacion: el servidor y el navegador se renderizan
 * en instantes distintos y la cadena resultante no coincidiria.
 */
function RelativeTime({ value }: { value: string }) {
  const isHydrated = useIsHydrated();

  if (!isHydrated) {
    return <span className="tabular text-muted-foreground">—</span>;
  }

  return (
    <span className="tabular whitespace-nowrap text-muted-foreground">
      hace {formatDistanceToNowStrict(new Date(value), { locale: es })}
    </span>
  );
}

export function TicketsView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Cliente, servicio y responsable llegan como enlace desde otras vistas.
  const clientId = searchParams.get('clientId') ?? '';
  const projectId = searchParams.get('projectId') ?? '';
  const assigneeId = searchParams.get('assigneeId') ?? '';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  // El estado tambien puede venir en la URL (por ejemplo desde "sin responsable").
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [priority, setPriority] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const query = useTickets({
    page,
    search: search || undefined,
    status: (status || undefined) as TicketStatus | undefined,
    priority: (priority || undefined) as TicketPriority | undefined,
    clientId: clientId || undefined,
    projectId: projectId || undefined,
    assigneeId: assigneeId || undefined,
  });

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
              className="block max-w-[24rem] truncate rounded-sm font-medium text-foreground hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/22"
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
        columnHelper.accessor((row) => row.assignee?.name ?? null, {
          id: 'assignee',
          header: 'Responsable',
          cell: (info) => (
            <span className="text-muted-foreground">{info.getValue() ?? 'Sin asignar'}</span>
          ),
        }),
        columnHelper.accessor('updatedAt', {
          header: 'Actualizado',
          cell: (info) => <RelativeTime value={info.getValue()} />,
        }),
      ]),
    [],
  );

  const hasFilters =
    search !== '' || status !== '' || priority !== '' || clientId || projectId || assigneeId;

  const resetFilters = () => {
    setSearch('');
    setStatus('');
    setPriority('');
    setPage(1);

    if (clientId || projectId || assigneeId) {
      router.replace('/admin/tickets');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tickets"
        description="Registro, seguimiento y resolucion de incidencias."
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <PlusIcon />
            Nuevo ticket
          </Button>
        }
      />

      <DataToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder="Buscar por codigo, asunto o descripcion…"
        onReset={hasFilters ? resetFilters : undefined}
      >
        <Select
          value={status || 'all'}
          onValueChange={(value) => {
            setStatus(value === 'all' ? '' : value);
            setPage(1);
          }}
        >
          <SelectTrigger size="sm" className="w-40" aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.values(TICKET_STATUSES).map((value) => (
              <SelectItem key={value} value={value}>
                {TICKET_STATUS_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={priority || 'all'}
          onValueChange={(value) => {
            setPriority(value === 'all' ? '' : value);
            setPage(1);
          }}
        >
          <SelectTrigger size="sm" className="w-40" aria-label="Filtrar por prioridad">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las prioridades</SelectItem>
            {Object.values(TICKET_PRIORITIES).map((value) => (
              <SelectItem key={value} value={value}>
                {TICKET_PRIORITY_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DataToolbar>

      {query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={query.data?.items ?? []}
            isLoading={query.isPending}
            emptyIcon={TicketIcon}
            emptyTitle={hasFilters ? 'Sin resultados' : 'Aun no hay tickets'}
            emptyDescription={
              hasFilters
                ? 'Prueba a cambiar la busqueda o los filtros.'
                : 'Cuando se registre la primera incidencia aparecera en esta tabla.'
            }
          />

          {query.data ? (
            <Pagination meta={query.data.meta} onPageChange={setPage} itemLabel="tickets" />
          ) : null}
        </>
      )}

      <TicketFormDialog open={formOpen} onOpenChange={setFormOpen} navigateOnCreate />
    </div>
  );
}
