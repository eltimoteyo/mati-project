'use client';

import {
  PROJECT_STATUSES,
  type ProjectWithClient,
  SERVICE_TYPE_LABELS,
  SERVICE_TYPES,
} from '@conit/types';
import {
  Badge,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  ErrorState,
  Pagination,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@conit/ui';
import { differenceInCalendarDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  BoxesIcon,
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  PencilIcon,
  PlusIcon,
  TicketIcon,
  Trash2Icon,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { DataToolbar } from '@/components/common/data-toolbar';
import { PageHeader } from '@/components/common/page-header';
import { createConitColumnHelper, DataTable } from '@/components/data-table/data-table';
import { ProjectStatusBadge, ServiceTypeBadge } from '@/components/domain/badges';
import { useDeleteProject, useProjects } from '@/hooks/use-projects';

import { ProjectFormDialog } from './project-form-dialog';

const columnHelper = createConitColumnHelper<ProjectWithClient>();

/** Umbral a partir del cual el vencimiento se destaca en la tabla. */
const EXPIRY_WARNING_DAYS = 30;

/** Vencimiento con aviso visual cuando esta cerca o ya paso. */
function ExpiryCell({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;

  const date = new Date(value);
  const days = differenceInCalendarDays(date, new Date());
  const expired = days < 0;
  const soon = !expired && days <= EXPIRY_WARNING_DAYS;

  return (
    <div className="flex flex-col">
      <span
        className={cn(
          'tabular whitespace-nowrap',
          expired && 'font-medium text-destructive',
          soon && 'font-medium text-warning',
          !expired && !soon && 'text-muted-foreground',
        )}
      >
        {format(date, 'd MMM yyyy', { locale: es })}
      </span>
      {expired ? (
        <span className="text-xs text-destructive">Vencido</span>
      ) : soon ? (
        <span className="text-xs text-warning">En {days} dia(s)</span>
      ) : null}
    </div>
  );
}

export function ProjectsView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [expiringSoon, setExpiringSoon] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectWithClient | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProjectWithClient | null>(null);

  const query = useProjects({
    page,
    search: search || undefined,
    type: type || undefined,
    status: status || undefined,
    expiringSoon: expiringSoon || undefined,
  });
  const deleteMutation = useDeleteProject();

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('name', {
          header: 'Servicio',
          cell: (info) => {
            const project = info.row.original;

            return (
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-foreground">{project.name}</span>
                {project.url ? (
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline"
                  >
                    {project.url.replace(/^https?:\/\//, '')}
                    <ExternalLinkIcon className="size-3" aria-hidden="true" />
                  </a>
                ) : null}
              </div>
            );
          },
        }),
        columnHelper.accessor((row) => row.client.name, {
          id: 'client',
          header: 'Cliente',
          cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
        }),
        columnHelper.accessor('type', {
          header: 'Tipo',
          cell: (info) => <ServiceTypeBadge type={info.getValue()} />,
        }),
        columnHelper.accessor('expiresAt', {
          header: 'Vencimiento',
          cell: (info) => <ExpiryCell value={info.getValue()} />,
        }),
        columnHelper.accessor((row) => row.counts.tickets, {
          id: 'tickets',
          header: 'Tickets',
          cell: (info) => <span className="tabular">{info.getValue()}</span>,
        }),
        columnHelper.accessor('status', {
          header: 'Estado',
          cell: (info) => <ProjectStatusBadge status={info.getValue()} />,
        }),
        columnHelper.display({
          id: 'actions',
          header: '',
          cell: ({ row }) => (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Acciones de ${row.original.name}`}
                  >
                    <EllipsisVerticalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    onSelect={() => {
                      setEditing(row.original);
                      setFormOpen(true);
                    }}
                  >
                    <PencilIcon />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/admin/tickets?projectId=${row.original.id}`}>
                      <TicketIcon />
                      Ver sus tickets
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setPendingDelete(row.original)}
                  >
                    <Trash2Icon />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ),
        }),
      ]),
    [],
  );

  const hasFilters = search !== '' || type !== '' || status !== '' || expiringSoon;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Proyectos y servicios"
        description="Inventario de todo lo que CONIT desarrolla y mantiene para cada cliente."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <PlusIcon />
            Nuevo servicio
          </Button>
        }
      />

      <DataToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder="Buscar por nombre, URL o descripcion…"
        onReset={
          hasFilters
            ? () => {
                setSearch('');
                setType('');
                setStatus('');
                setExpiringSoon(false);
                setPage(1);
              }
            : undefined
        }
      >
        <Select
          value={type || 'all'}
          onValueChange={(value) => {
            setType(value === 'all' ? '' : value);
            setPage(1);
          }}
        >
          <SelectTrigger size="sm" className="w-48" aria-label="Filtrar por tipo de servicio">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {Object.values(SERVICE_TYPES).map((value) => (
              <SelectItem key={value} value={value}>
                {SERVICE_TYPE_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
            <SelectItem value={PROJECT_STATUSES.ACTIVE}>Activos</SelectItem>
            <SelectItem value={PROJECT_STATUSES.SUSPENDED}>Suspendidos</SelectItem>
            <SelectItem value={PROJECT_STATUSES.ARCHIVED}>Archivados</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={expiringSoon ? 'default' : 'outline'}
          size="sm"
          aria-pressed={expiringSoon}
          onClick={() => {
            setExpiringSoon((value) => !value);
            setPage(1);
          }}
        >
          Vencen pronto
          {expiringSoon ? <Badge variant="neutral">30 dias</Badge> : null}
        </Button>
      </DataToolbar>

      {query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={query.data?.items ?? []}
            isLoading={query.isPending}
            emptyIcon={BoxesIcon}
            emptyTitle={hasFilters ? 'Sin resultados' : 'Aun no hay servicios'}
            emptyDescription={
              hasFilters
                ? 'Prueba a cambiar la busqueda o los filtros.'
                : 'Registra los servicios contratados para poder asociarles incidencias.'
            }
          />

          {query.data ? (
            <Pagination meta={query.data.meta} onPageChange={setPage} itemLabel="servicios" />
          ) : null}
        </>
      )}

      <ProjectFormDialog open={formOpen} onOpenChange={setFormOpen} project={editing} />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Eliminar servicio"
        description={
          <>
            Se eliminara <strong>{pendingDelete?.name}</strong>. Esta accion no se puede deshacer.
            {pendingDelete && pendingDelete.counts.tickets > 0 ? (
              <>
                {' '}
                Tiene {pendingDelete.counts.tickets} ticket(s) asociados, asi que el servidor
                rechazara el borrado: archivalo en su lugar.
              </>
            ) : null}
          </>
        }
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (!pendingDelete) return;

          deleteMutation.mutate(pendingDelete.id, { onSettled: () => setPendingDelete(null) });
        }}
      />
    </div>
  );
}
