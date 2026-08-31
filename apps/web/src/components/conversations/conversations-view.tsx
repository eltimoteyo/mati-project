'use client';

import {
  OPEN_TICKET_STATUSES,
  type Ticket,
  TICKET_STATUS_LABELS,
  TICKET_STATUSES,
  type TicketStatus,
} from '@conit/types';
import {
  Badge,
  Button,
  Card,
  cn,
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
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MessagesSquareIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { DataToolbar } from '@/components/common/data-toolbar';
import { PageHeader } from '@/components/common/page-header';
import { TicketPriorityBadge, TicketStatusBadge } from '@/components/domain/badges';
import { useTickets } from '@/hooks/use-tickets';

/** Una fila de la bandeja. */
function ConversationRow({ ticket }: { ticket: Ticket }) {
  const withoutReply = ticket.messageCount === 0;

  return (
    <li>
      <Link
        href={`/admin/tickets/${ticket.code}`}
        className={cn(
          'flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3.5',
          'transition-colors hover:border-primary/30 hover:bg-accent/40',
          'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/22',
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="tabular font-mono text-xs font-medium text-primary">{ticket.code}</span>
          <span className="min-w-0 flex-1 truncate font-medium text-foreground">
            {ticket.subject}
          </span>
          <TicketStatusBadge status={ticket.status} />
          <TicketPriorityBadge priority={ticket.priority} />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="truncate">{ticket.client.name}</span>

          <span className="flex items-center gap-1.5">
            <MessagesSquareIcon className="size-3.5" aria-hidden="true" />
            <span className="tabular">{ticket.messageCount}</span>
          </span>

          {/* Un ticket abierto sin ningun mensaje es el caso que mas urge:
              nadie ha contestado todavia. */}
          {withoutReply ? <Badge variant="danger">Sin responder</Badge> : null}

          <span className="tabular ml-auto whitespace-nowrap">
            {format(new Date(ticket.updatedAt), "d MMM, HH:mm", { locale: es })}
          </span>
        </div>
      </Link>
    </li>
  );
}

/**
 * Bandeja de conversaciones.
 *
 * Es una vista de trabajo, no un listado administrativo: prioriza los tickets
 * abiertos ordenados por actividad reciente y destaca los que aun no tienen
 * ninguna respuesta. Para la gestion completa esta el modulo de Tickets.
 */
export function ConversationsView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const query = useTickets({
    page,
    search: search || undefined,
    status: (status || undefined) as TicketStatus | undefined,
    openOnly: status === '',
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  });

  const hasFilters = search !== '' || status !== '';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Conversaciones"
        description="Hilos de atencion ordenados por actividad reciente."
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/tickets">Ir a tickets</Link>
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
          value={status || 'open'}
          onValueChange={(value) => {
            setStatus(value === 'open' ? '' : value);
            setPage(1);
          }}
        >
          <SelectTrigger size="sm" className="w-44" aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Solo abiertos</SelectItem>
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
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-[4.75rem] w-full rounded-lg" />
          ))}
        </div>
      ) : (query.data?.items.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            icon={MessagesSquareIcon}
            title={hasFilters ? 'Sin resultados' : 'No hay conversaciones abiertas'}
            description={
              hasFilters
                ? 'Prueba a cambiar la busqueda o el filtro de estado.'
                : `Todo atendido: no queda ningun ticket en ${OPEN_TICKET_STATUSES.length} estados abiertos.`
            }
          />
        </Card>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {(query.data?.items ?? []).map((ticket) => (
              <ConversationRow key={ticket.id} ticket={ticket} />
            ))}
          </ul>

          {query.data ? (
            <Pagination meta={query.data.meta} onPageChange={setPage} itemLabel="conversaciones" />
          ) : null}
        </>
      )}
    </div>
  );
}
