'use client';

import { CLIENT_STATUSES, type ClientWithCounts } from '@conit/types';
import {
  Badge,
  Button,
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
import {
  EllipsisVerticalIcon,
  PencilIcon,
  PlusIcon,
  TicketIcon,
  Trash2Icon,
  UsersIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { DataToolbar } from '@/components/common/data-toolbar';
import { PageHeader } from '@/components/common/page-header';
import { createConitColumnHelper, DataTable } from '@/components/data-table/data-table';
import { ActiveStatusBadge } from '@/components/domain/badges';
import { useClients, useDeleteClient } from '@/hooks/use-clients';

import { ClientFormDialog } from './client-form-dialog';

const columnHelper = createConitColumnHelper<ClientWithCounts>();

export function ClientsView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClientWithCounts | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ClientWithCounts | null>(null);

  const query = useClients({ page, search: search || undefined, status: status || undefined });
  const deleteMutation = useDeleteClient();

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('name', {
          header: 'Cliente',
          cell: (info) => {
            const client = info.row.original;

            return (
              <div className="flex flex-col">
                <span className="font-medium text-foreground">{client.name}</span>
                <span className="text-xs text-muted-foreground">{client.email}</span>
              </div>
            );
          },
        }),
        columnHelper.accessor('contactName', {
          header: 'Contacto',
          cell: (info) => {
            const client = info.row.original;

            return (
              <div className="flex flex-col text-muted-foreground">
                <span>{info.getValue() ?? '—'}</span>
                {client.phone ? <span className="tabular text-xs">{client.phone}</span> : null}
              </div>
            );
          },
        }),
        columnHelper.accessor((row) => row.counts.projects, {
          id: 'projects',
          header: 'Servicios',
          cell: (info) => <span className="tabular">{info.getValue()}</span>,
        }),
        columnHelper.accessor((row) => row.counts.openTickets, {
          id: 'openTickets',
          header: 'Tickets abiertos',
          cell: (info) => {
            const open = info.getValue();
            const total = info.row.original.counts.tickets;

            return (
              <span className="tabular flex items-center gap-1.5">
                {open > 0 ? (
                  <Badge variant={open > 3 ? 'warning' : 'info'}>{open}</Badge>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
                <span className="text-xs text-muted-foreground">de {total}</span>
              </span>
            );
          },
        }),
        columnHelper.accessor('status', {
          header: 'Estado',
          cell: (info) => <ActiveStatusBadge status={info.getValue()} />,
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
                    <Link href={`/admin/tickets?clientId=${row.original.id}`}>
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

  const hasFilters = search !== '' || status !== '';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clientes"
        description="Empresas y contactos con servicios contratados."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <PlusIcon />
            Nuevo cliente
          </Button>
        }
      />

      <DataToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder="Buscar por nombre, correo o RUC…"
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
          <SelectTrigger size="sm" className="w-40" aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value={CLIENT_STATUSES.ACTIVE}>Activos</SelectItem>
            <SelectItem value={CLIENT_STATUSES.INACTIVE}>Inactivos</SelectItem>
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
            emptyIcon={UsersIcon}
            emptyTitle={hasFilters ? 'Sin resultados' : 'Aun no hay clientes'}
            emptyDescription={
              hasFilters
                ? 'Prueba a cambiar la busqueda o los filtros.'
                : 'Registra el primer cliente para empezar a gestionar sus servicios e incidencias.'
            }
          />

          {query.data ? (
            <Pagination meta={query.data.meta} onPageChange={setPage} itemLabel="clientes" />
          ) : null}
        </>
      )}

      <ClientFormDialog open={formOpen} onOpenChange={setFormOpen} client={editing} />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Eliminar cliente"
        description={
          <>
            Se eliminara <strong>{pendingDelete?.name}</strong> junto con sus servicios. Esta accion
            no se puede deshacer.
            {pendingDelete && pendingDelete.counts.tickets > 0 ? (
              <>
                {' '}
                Tiene {pendingDelete.counts.tickets} ticket(s) registrados, asi que el servidor
                rechazara el borrado: cambialo a inactivo en su lugar.
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
