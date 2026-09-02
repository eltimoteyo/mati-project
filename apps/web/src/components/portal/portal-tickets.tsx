'use client';

import { TICKET_STATUS_LABELS, TICKET_STATUSES, type TicketStatus } from '@conit/types';
import {
  EmptyState,
  ErrorState,
  Pagination,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@conit/ui';
import { TicketIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { DataToolbar } from '@/components/common/data-toolbar';
import { usePortalTickets } from '@/hooks/use-portal';

import { PortalTicketRow } from './portal-home';

/** Listado completo de las incidencias del cliente. */
export function PortalTickets() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const filters = useMemo(
    () => ({
      page,
      search: search || undefined,
      status: (status || undefined) as TicketStatus | undefined,
    }),
    [page, search, status],
  );

  const query = usePortalTickets(filters);
  const hasFilters = search !== '' || status !== '';
  const tickets = query.data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Mis incidencias</h1>
          <p className="text-sm text-muted-foreground">
            Todo lo que has reportado, con su estado actual.
          </p>
        </div>
      </div>

      <DataToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder="Buscar por codigo o asunto…"
        onReset={
          hasFilters
            ? () => {
                setSearch('');
                setStatus('');
                setPage(1);
              }
            : undefined
        }
      >
        <Select
          value={status || 'all'}
          onValueChange={(value) => {
            setStatus(value === 'all' ? '' : value);
            setPage(1);
          }}
        >
          <SelectTrigger size="sm" className="w-44" aria-label="Filtrar por estado">
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
      </DataToolbar>

      {query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={TicketIcon}
          title={hasFilters ? 'Sin resultados' : 'Aun no has reportado nada'}
          description={
            hasFilters
              ? 'Prueba a cambiar la busqueda o el estado.'
              : 'Cuando tengas una incidencia, registrala y podras seguirla desde aqui.'
          }
          className="rounded-xl border border-border/80 bg-card/90 py-14 shadow-subtle"
        />
      ) : (
        <>
          <div className="flex flex-col gap-2.5">
            {tickets.map((ticket) => (
              <PortalTicketRow key={ticket.id} ticket={ticket} />
            ))}
          </div>

          {query.data ? (
            <Pagination meta={query.data.meta} onPageChange={setPage} itemLabel="incidencias" />
          ) : null}
        </>
      )}
    </div>
  );
}
