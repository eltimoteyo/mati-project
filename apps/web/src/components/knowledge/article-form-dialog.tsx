'use client';

import type { Article } from '@conit/types';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@conit/ui';
import {
  type CreateArticleFormInput,
  type CreateArticleFormValues,
  createArticleSchema,
} from '@conit/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { useCreateArticle, useUpdateArticle } from '@/hooks/use-articles';
import { useCategoryOptions } from '@/hooks/use-categories';
import { applyApiFieldErrors } from '@/lib/form-errors';
import { notify } from '@/lib/notify';

const EMPTY: CreateArticleFormInput = {
  title: '',
  slug: '',
  summary: '',
  content: '',
  categoryId: '',
  isPublished: true,
};

const KNOWN_FIELDS = ['title', 'slug', 'summary', 'content', 'categoryId'] as const;

/** Sin categoria: `Select` no admite el valor vacio, hace falta un centinela. */
const NO_CATEGORY = 'none';

interface ArticleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Articulo a editar; `null` para alta. */
  article: Article | null;
  /** Se invoca con el slug resultante tras crear o renombrar. */
  onSaved?: (slug: string) => void;
}

/**
 * Alta y edicion de articulos.
 *
 * Un solo dialogo cubre ambos casos: los campos son los mismos y mantener dos
 * formularios paralelos solo garantiza que acaben divergiendo.
 */
export function ArticleFormDialog({
  open,
  onOpenChange,
  article,
  onSaved,
}: ArticleFormDialogProps) {
  const isEdit = article !== null;
  const createMutation = useCreateArticle();
  const updateMutation = useUpdateArticle();
  const mutation = isEdit ? updateMutation : createMutation;
  const categories = useCategoryOptions(open);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors },
  } = useForm<CreateArticleFormInput, unknown, CreateArticleFormValues>({
    resolver: zodResolver(createArticleSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!open) return;

    reset(
      article
        ? {
            title: article.title,
            slug: article.slug,
            summary: article.summary ?? '',
            content: article.content,
            categoryId: article.category?.id ?? '',
            isPublished: article.isPublished,
          }
        : EMPTY,
    );
  }, [open, article, reset]);

  const onSubmit = handleSubmit((values) => {
    const payload = {
      title: values.title,
      // Un slug vacio se omite: el servidor lo deriva del titulo.
      ...(values.slug ? { slug: values.slug } : {}),
      summary: values.summary ?? null,
      content: values.content,
      categoryId: values.categoryId ?? null,
      isPublished: values.isPublished,
    };

    const onError = (error: unknown) => {
      if (!applyApiFieldErrors(error, setError, KNOWN_FIELDS)) {
        notify.fromError(error, 'No se pudo guardar el articulo.');
      }
    };

    const onSuccess = (saved: Article) => {
      onOpenChange(false);
      onSaved?.(saved.slug);
    };

    if (isEdit) {
      updateMutation.mutate({ idOrSlug: article.id, input: payload }, { onSuccess, onError });
    } else {
      createMutation.mutate(payload, { onSuccess, onError });
    }
  });

  return (
    <Dialog open={open} onOpenChange={mutation.isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar articulo' : 'Nuevo articulo'}</DialogTitle>
          <DialogDescription>
            Documenta una solucion o procedimiento para resolver incidencias mas rapido.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="contents">
          <DialogBody className="flex flex-col gap-5">
            <Field label="Titulo" error={errors.title?.message} required>
              {(field) => (
                <Input
                  {...field}
                  {...register('title')}
                  placeholder="Como renovar un certificado SSL"
                  invalid={Boolean(errors.title)}
                />
              )}
            </Field>

            <Field
              label="Resumen"
              error={errors.summary?.message}
              hint="Una linea que explique cuando aplicar este articulo."
            >
              {(field) => (
                <Textarea
                  {...field}
                  {...register('summary')}
                  rows={2}
                  invalid={Boolean(errors.summary)}
                />
              )}
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Categoria" error={errors.categoryId?.message}>
                {(field) => (
                  <Controller
                    control={control}
                    name="categoryId"
                    render={({ field: select }) => (
                      <Select
                        value={select.value ? String(select.value) : NO_CATEGORY}
                        onValueChange={(value) =>
                          select.onChange(value === NO_CATEGORY ? '' : value)
                        }
                      >
                        <SelectTrigger id={field.id} aria-describedby={field['aria-describedby']}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_CATEGORY}>Sin categoria</SelectItem>
                          {(categories.data ?? []).map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
              </Field>

              <Field label="Visibilidad" error={errors.isPublished?.message}>
                {(field) => (
                  <Controller
                    control={control}
                    name="isPublished"
                    render={({ field: select }) => (
                      <Select
                        value={select.value ? 'published' : 'draft'}
                        onValueChange={(value) => select.onChange(value === 'published')}
                      >
                        <SelectTrigger id={field.id} aria-describedby={field['aria-describedby']}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="published">Publicado</SelectItem>
                          <SelectItem value="draft">Borrador</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
              </Field>
            </div>

            <Field
              label="Contenido"
              error={errors.content?.message}
              required
              hint="Admite Markdown: titulos (#), listas (-), codigo (```), negrita (**) y enlaces."
            >
              {(field) => (
                <Textarea
                  {...field}
                  {...register('content')}
                  rows={14}
                  className="font-mono text-xs"
                  placeholder={'## Diagnostico\n\n1. Revisa la fecha de caducidad…'}
                  invalid={Boolean(errors.content)}
                />
              )}
            </Field>

            <Field
              label="Identificador de URL"
              error={errors.slug?.message}
              hint="Se deriva del titulo si lo dejas vacio. Cambiarlo rompe los enlaces ya compartidos."
            >
              {(field) => (
                <Input
                  {...field}
                  {...register('slug')}
                  placeholder="como-renovar-un-certificado-ssl"
                  className="font-mono text-xs"
                  invalid={Boolean(errors.slug)}
                />
              )}
            </Field>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={mutation.isPending} loadingText="Guardando…">
              {isEdit ? 'Guardar cambios' : 'Crear articulo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
