'use client';

import type { Article, ArticleListItem } from '@conit/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
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
import { formatDistanceToNowStrict } from 'date-fns';
import { es } from 'date-fns/locale';
import { BookOpenIcon, EyeIcon, FileTextIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { DataToolbar } from '@/components/common/data-toolbar';
import { PageHeader } from '@/components/common/page-header';
import { useArticles, useArticlesSummary } from '@/hooks/use-articles';
import { useCategoryOptions } from '@/hooks/use-categories';
import { useIsHydrated } from '@/hooks/use-is-hydrated';

import { ArticleFormDialog } from './article-form-dialog';

const VISIBILITY_OPTIONS = [
  { value: 'all', label: 'Publicados y borradores' },
  { value: 'true', label: 'Solo publicados' },
  { value: 'false', label: 'Solo borradores' },
] as const;

function Updated({ value }: { value: string }) {
  const isHydrated = useIsHydrated();

  if (!isHydrated) return <span className="text-muted-foreground">—</span>;

  return (
    <span className="whitespace-nowrap text-muted-foreground">
      hace {formatDistanceToNowStrict(new Date(value), { locale: es })}
    </span>
  );
}

/** Tarjeta de un articulo. Se prefiere a una tabla: el resumen necesita ancho. */
function ArticleCard({ article }: { article: ArticleListItem }) {
  return (
    <Card className="group transition-colors hover:border-primary/30">
      <CardContent className="flex h-full flex-col gap-3 py-5">
        <div className="flex items-start justify-between gap-3">
          <Link
            href={`/admin/base-conocimiento/${article.slug}`}
            className="rounded-sm font-medium text-foreground group-hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/22"
          >
            {article.title}
          </Link>

          {article.isPublished ? null : (
            <Badge variant="warning" className="shrink-0">
              Borrador
            </Badge>
          )}
        </div>

        {article.summary ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{article.summary}</p>
        ) : (
          <p className="text-sm text-muted-foreground/70 italic">Sin resumen</p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
          {article.category ? <span>{article.category.name}</span> : null}
          <span className="inline-flex items-center gap-1">
            <EyeIcon className="size-3" aria-hidden="true" />
            <span className="tabular">{article.viewsCount}</span>
          </span>
          <Updated value={article.updatedAt} />
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryStrip() {
  const summary = useArticlesSummary();

  const stats = [
    { label: 'Articulos', value: summary.data?.total ?? 0, icon: FileTextIcon },
    { label: 'Publicados', value: summary.data?.published ?? 0, icon: BookOpenIcon },
    { label: 'Borradores', value: summary.data?.drafts ?? 0, icon: FileTextIcon },
    { label: 'Lecturas', value: summary.data?.totalViews ?? 0, icon: EyeIcon },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(({ label, value, icon: Icon }) => (
        <Card key={label}>
          <CardContent className="flex items-center gap-3 py-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium tracking-[0.04em] text-muted-foreground uppercase">
                {label}
              </span>
              {summary.isPending ? (
                <Skeleton className="h-6 w-12" />
              ) : (
                <span className="tabular text-xl font-semibold text-foreground">{value}</span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Base de conocimiento.
 *
 * El listado se presenta en tarjetas y no en tabla porque lo que hace util a un
 * articulo es su resumen, y un resumen no cabe en una celda.
 */
export function KnowledgeView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [visibility, setVisibility] = useState('all');
  const [formOpen, setFormOpen] = useState(false);

  const categories = useCategoryOptions();

  const filters = useMemo(
    () => ({
      page,
      search: search || undefined,
      categoryId: categoryId || undefined,
      isPublished: visibility === 'all' ? undefined : visibility === 'true',
    }),
    [page, search, categoryId, visibility],
  );

  const query = useArticles(filters);
  const hasFilters = search !== '' || categoryId !== '' || visibility !== 'all';

  const resetFilters = () => {
    setSearch('');
    setCategoryId('');
    setVisibility('all');
    setPage(1);
  };

  const articles = query.data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Base de conocimiento"
        description="Guias, soluciones y procedimientos para resolver incidencias frecuentes."
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <PlusIcon />
            Nuevo articulo
          </Button>
        }
      />

      <SummaryStrip />

      <DataToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder="Buscar en titulo, resumen y contenido…"
        onReset={hasFilters ? resetFilters : undefined}
      >
        <Select
          value={categoryId || 'all'}
          onValueChange={(value) => {
            setCategoryId(value === 'all' ? '' : value);
            setPage(1);
          }}
        >
          <SelectTrigger size="sm" className="w-44" aria-label="Filtrar por categoria">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorias</SelectItem>
            {(categories.data ?? []).map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={visibility}
          onValueChange={(value) => {
            setVisibility(value);
            setPage(1);
          }}
        >
          <SelectTrigger size="sm" className="w-52" aria-label="Filtrar por visibilidad">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VISIBILITY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DataToolbar>

      {query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <EmptyState
          icon={BookOpenIcon}
          title={hasFilters ? 'Sin resultados' : 'Aun no hay articulos'}
          description={
            hasFilters
              ? 'Prueba a cambiar la busqueda o a quitar algun filtro.'
              : 'Documenta la primera solucion para que el equipo no la resuelva dos veces.'
          }
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>

          {query.data ? (
            <Pagination meta={query.data.meta} onPageChange={setPage} itemLabel="articulos" />
          ) : null}
        </>
      )}

      <ArticleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        article={null as Article | null}
      />
    </div>
  );
}
