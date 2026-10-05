'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  ErrorState,
  PageLoader,
  Separator,
} from '@conit/ui';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeftIcon, EyeIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { PageHeader } from '@/components/common/page-header';
import { useArticle, useDeleteArticle, useRegisterArticleView } from '@/hooks/use-articles';

import { ArticleFormDialog } from './article-form-dialog';
import { Markdown } from './markdown';

interface ArticleDetailViewProps {
  slug: string;
}

export function ArticleDetailView({ slug }: ArticleDetailViewProps) {
  const router = useRouter();
  const query = useArticle(slug);
  const deleteMutation = useDeleteArticle();
  // `mutate` es estable entre renders, asi puede ser dependencia del efecto
  // sin volver a dispararlo en cada ciclo.
  const { mutate: registerView } = useRegisterArticleView();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Una lectura por articulo y por visita: sin esta guarda, cada refetch de
  // TanStack volveria a contar y el indicador dejaria de significar nada.
  const countedSlug = useRef<string | null>(null);

  useEffect(() => {
    if (countedSlug.current === slug) return;

    countedSlug.current = slug;
    registerView(slug);
  }, [slug, registerView]);

  if (query.isPending) {
    return <PageLoader message="Cargando articulo…" />;
  }

  if (query.isError || !query.data) {
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const article = query.data;

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="w-fit -ml-2">
        <Link href="/admin/base-conocimiento">
          <ArrowLeftIcon />
          Volver a la base de conocimiento
        </Link>
      </Button>

      <PageHeader
        title={article.title}
        description={article.summary ?? undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <PencilIcon />
              Editar
            </Button>
            <Button variant="outline" onClick={() => setConfirmOpen(true)}>
              <Trash2Icon />
              Eliminar
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {article.isPublished ? (
          <Badge variant="success">Publicado</Badge>
        ) : (
          <Badge variant="warning">Borrador</Badge>
        )}

         {article.category ? <span>{article.category.name}</span> : null}
         {article.author ? <span>Por {article.author.name}</span> : null}

         <span className="inline-flex items-center gap-1">
           <EyeIcon className="size-3" aria-hidden="true" />
           <span className="tabular">{article.viewsCount} lecturas</span>
         </span>

         <time dateTime={article.updatedAt} className="tabular">
           Actualizado el {format(new Date(article.updatedAt), "d 'de' MMMM 'de' yyyy", { locale: es })}
         </time>
       </div>

       <Separator />

      <Card>
        <CardContent className="py-6">
          <Markdown content={article.content} />
        </CardContent>
      </Card>

      <ArticleFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        article={article}
        // El slug puede cambiar al guardar; si lo hace, la URL debe seguirlo.
        onSaved={(nextSlug) => {
          if (nextSlug !== slug) router.replace(`/admin/base-conocimiento/${nextSlug}`);
        }}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Eliminar articulo"
        description={`"${article.title}" se eliminara de forma permanente.`}
        confirmLabel="Eliminar"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          deleteMutation.mutate(article.id, {
            onSuccess: () => router.push('/admin/base-conocimiento'),
          });
        }}
      />
    </div>
  );
}
