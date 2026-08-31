'use client';

import type { AuditEntry } from '@conit/types';
import { TICKET_EVENT_TYPES } from '@conit/types';
import {
  Card,
  CardContent,
  ErrorState,
  Input,
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
import { CircleDotIcon, HistoryIcon } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { DataToolbar } from '@/components/common/data-toolbar';
import { PageHeader } from '@/components/common/page-header';
import { createConitColumnHelper, DataTable } from '@/components/data-table/data-table';
import {
  describeTicketEvent,
  TICKET_EVENT_ICONS,
  TICKET_EVENT_LABELS,
} from '@/components/domain/ticket-events';
import { useAuditEntries, useAuditSummary } from '@/hooks/use-audit';
import { useAssignableUsers } from '@/hooks/use-tickets';

const columnHelper = createConitColumnHelper<AuditEntry>();

/** Fecha absoluta: en una auditoria importa el momento exacto, no "hace 3 h". */
function formatMoment(value: string): string {
  return format(new Date(value), "d MMM yyyy, HH:mm", { locale: es });
}

interface SummaryCardProps {
  label: string;
  value: number | string;
  hint: string;
  isLoading: boolean;
}

function SummaryCard({ label, value, hint, isLoading }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5 py-5">
        <span className="text-xs font-medium tracking-[0.04em] text-muted-foreground uppercase">
          {label}
        </span>
        {isLoading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <span className="tabular text-2xl font-semibold text-foreground">{value}</span>
        )}
        <span className="text-xs text-muted-foreground">{hint}</span>
      </CardContent>
    </Card>
  );
}

/**
 * Historial de auditoria.
 *
 * Muestra los mismos eventos que la ficha de cada ticket, pero en un unico
 * flujo consultable. Es solo lectura: la interfaz no ofrece editar ni borrar
 * porque el registro perderia su valor si se pudiera retocar.
 */
export function AuditView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [actorId, setActorId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filters = useMemo(
    () => ({
      page,
      search: search || undefined,
      type: (type || undefined) as AuditEntry['type'] | undefined,
      actorId: actorId || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [page, search, type, actorId, from, to],
  );

  const query = useAuditEntries(filters);
  const summary = useAuditSummary(filters);
  const actors = useAssignableUsers();

  const topType = summary.data?.byType[0];

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('createdAt', {
          header: 'Fecha',
          cell: (info) => (
            <time
              dateTime={info.getValue()}
              className="tabular whitespace-nowrap text-muted-foreground"
            >
              {formatMoment(info.getValue())}
            </time>
          ),
        }),
        columnHelper.accessor((row) => row.ticket.code, {
          id: 'ticket',
          header: 'Ticket',
          cell: (info) => (
            <Link
              href={`/admin/tickets/${info.getValue()}`}
              className="tabular rounded-sm font-mono text-xs font-medium text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/22"
              title={info.row.original.ticket.subject}
            >
              {info.getValue()}
            </Link>
          ),
        }),
        columnHelper.accessor((row) => row.actor?.name ?? null, {
          id: 'actor',
          header: 'Autor',
          cell: (info) => (
            <span className="block max-w-[12rem] truncate text-muted-foreground">
              {info.getValue() ?? 'Sistema'}
            </span>
          ),
        }),
        columnHelper.accessor('type', {
          header: 'Cambio',
          cell: (info) => {
            const entry = info.row.original;
            const Icon = TICKET_EVENT_ICONS[entry.type] ?? CircleDotIcon;

            return (
              <div className="flex min-w-0 items-start gap-2">
                <Icon
                  className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="min-w-0 text-sm text-muted-foreground">
                  {describeTicketEvent(entry)}
                </span>
              </div>
            );
          },
        }),
      ]),
    [],
  );

  const hasFilters = search !== '' || type !== '' || actorId !== '' || from !== '' || to !== '';

  const resetFilters = () => {
    setSearch('');
    setType('');
    setActorId('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Historial"
        description="Registro de auditoria de todos los cambios sobre los tickets."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Eventos"
          value={summary.data?.total ?? 0}
          hint={hasFilters ? 'Con los filtros aplicados' : 'Desde el inicio'}
          isLoading={summary.isPending}
        />
        <SummaryCard
          label="Tickets afectados"
          value={summary.data?.tickets ?? 0}
          hint="Distintos en el periodo"
          isLoading={summary.isPending}
        />
        <SummaryCard
          label="Usuarios"
          value={summary.data?.actors ?? 0}
          hint="Provocaron algun cambio"
          isLoading={summary.isPending}
        />
        <SummaryCard
          label="Cambio mas frecuente"
          value={topType ? TICKET_EVENT_LABELS[topType.type] : '—'}
          hint={topType ? `${topType.count} registros` : 'Sin datos todavia'}
          isLoading={summary.isPending}
        />
      </div>

      <DataToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder="Buscar por codigo, asunto o valor…"
        onReset={hasFilters ? resetFilters : undefined}
      >
        <Select
          value={type || 'all'}
          onValueChange={(value) => {
            setType(value === 'all' ? '' : value);
            setPage(1);
          }}
        >
          <SelectTrigger size="sm" className="w-48" aria-label="Filtrar por tipo de cambio">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los cambios</SelectItem>
            {Object.values(TICKET_EVENT_TYPES).map((value) => (
              <SelectItem key={value} value={value}>
                {TICKET_EVENT_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={actorId || 'all'}
          onValueChange={(value) => {
            setActorId(value === 'all' ? '' : value);
            setPage(1);
          }}
        >
          <SelectTrigger size="sm" className="w-44" aria-label="Filtrar por autor">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los autores</SelectItem>
            {(actors.data ?? []).map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(event) => {
            setFrom(event.target.value);
            setPage(1);
          }}
          aria-label="Desde la fecha"
          className="h-8 w-[9.5rem] text-sm"
        />
        <Input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(event) => {
            setTo(event.target.value);
            setPage(1);
          }}
          aria-label="Hasta la fecha"
          className="h-8 w-[9.5rem] text-sm"
        />
      </DataToolbar>

      {query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={query.data?.items ?? []}
            isLoading={query.isPending}
            emptyIcon={HistoryIcon}
            emptyTitle={hasFilters ? 'Sin resultados' : 'Aun no hay actividad'}
            emptyDescription={
              hasFilters
                ? 'Prueba a ampliar el rango de fechas o a quitar algun filtro.'
                : 'Cada cambio sobre un ticket quedara registrado aqui.'
            }
          />

          {query.data ? (
            <Pagination meta={query.data.meta} onPageChange={setPage} itemLabel="eventos" />
          ) : null}
        </>
      )}
    </div>
  );
}
