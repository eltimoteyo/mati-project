'use client';

import { CATEGORY_STATUSES, type CategoryWithCounts } from '@conit/types';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ErrorState,
  Pagination,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@conit/ui';
import { EllipsisVerticalIcon, PencilIcon, PlusIcon, TagIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { DataToolbar } from '@/components/common/data-toolbar';
import { PageHeader } from '@/components/common/page-header';
import { createConitColumnHelper, DataTable } from '@/components/data-table/data-table';
import { categoryVariant } from '@/components/domain/badges';
import { useCategories, useDeleteCategory } from '@/hooks/use-categories';

import { CategoryFormDialog } from './category-form-dialog';

const columnHelper = createConitColumnHelper<CategoryWithCounts>();

/** Formatea minutos como "45 min" o "8 h", segun cuadre mejor. */
function formatMinutes(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 60) return `${minutes} min`;

  const hours = minutes / 60;

  return Number.isInteger(hours) ? `${hours} h` : `${hours.toFixed(1)} h`;
}

export function CategoriesView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryWithCounts | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CategoryWithCounts | null>(null);

  const query = useCategories({ page, search: search || undefined, status: status || undefined });
  const deleteMutation = useDeleteCategory();

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('name', {
          header: 'Categoria',
          cell: (info) => {
            const category = info.row.original;

            return (
              <div className="flex flex-col gap-1">
                <Badge variant={categoryVariant(category.color)}>{category.name}</Badge>
                {category.description ? (
                  <span className="block max-w-sm truncate text-xs text-muted-foreground">
                    {category.description}
                  </span>
                ) : null}
              </div>
            );
          },
        }),
        columnHelper.accessor('responseTimeMinutes', {
          header: 'Primera respuesta',
          cell: (info) => (
            <span className="tabular text-muted-foreground">{formatMinutes(info.getValue())}</span>
          ),
        }),
        columnHelper.accessor('resolutionTimeMinutes', {
          header: 'Resolucion',
          cell: (info) => (
            <span className="tabular text-muted-foreground">{formatMinutes(info.getValue())}</span>
          ),
        }),
        columnHelper.accessor((row) => row.counts.tickets, {
          id: 'tickets',
          header: 'Tickets',
          cell: (info) => <span className="tabular">{info.getValue()}</span>,
        }),
        columnHelper.accessor('status', {
          header: 'Estado',
          cell: (info) => (
            <Badge variant={info.getValue() === CATEGORY_STATUSES.ACTIVE ? 'success' : 'neutral'}>
              {info.getValue() === CATEGORY_STATUSES.ACTIVE ? 'Activa' : 'Inactiva'}
            </Badge>
          ),
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
        title="Categorias"
        description="Clasificacion de incidencias y tiempos objetivo de atencion."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <PlusIcon />
            Nueva categoria
          </Button>
        }
      />

      <DataToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder="Buscar por nombre o descripcion…"
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
            <SelectItem value={CATEGORY_STATUSES.ACTIVE}>Activas</SelectItem>
            <SelectItem value={CATEGORY_STATUSES.INACTIVE}>Inactivas</SelectItem>
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
            emptyIcon={TagIcon}
            emptyTitle={hasFilters ? 'Sin resultados' : 'Aun no hay categorias'}
            emptyDescription={
              hasFilters
                ? 'Prueba a cambiar la busqueda o los filtros.'
                : 'Crea la primera categoria para empezar a clasificar incidencias.'
            }
          />

          {query.data ? (
            <Pagination meta={query.data.meta} onPageChange={setPage} itemLabel="categorias" />
          ) : null}
        </>
      )}

      <CategoryFormDialog open={formOpen} onOpenChange={setFormOpen} category={editing} />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Eliminar categoria"
        description={
          <>
            Se eliminara <strong>{pendingDelete?.name}</strong>. Esta accion no se puede deshacer.
            {pendingDelete && pendingDelete.counts.tickets > 0 ? (
              <>
                {' '}
                La categoria tiene {pendingDelete.counts.tickets} ticket(s) asociados, asi que el
                servidor rechazara el borrado: desactivala en su lugar.
              </>
            ) : null}
          </>
        }
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (!pendingDelete) return;

          deleteMutation.mutate(pendingDelete.id, {
            onSettled: () => setPendingDelete(null),
          });
        }}
      />
    </div>
  );
}
