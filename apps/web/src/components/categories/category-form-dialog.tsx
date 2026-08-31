'use client';

import {
  CATEGORY_COLORS,
  CATEGORY_STATUSES,
  type CategoryColor,
  type CategoryStatus,
  type CategoryWithCounts,
} from '@conit/types';
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
  type CreateCategoryFormInput,
  type CreateCategoryFormValues,
  createCategorySchema,
} from '@conit/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { useCreateCategory, useUpdateCategory } from '@/hooks/use-categories';
import { applyApiFieldErrors } from '@/lib/form-errors';
import { notify } from '@/lib/notify';

const COLOR_LABELS: Record<CategoryColor, string> = {
  BRAND: 'Corporativo',
  INFO: 'Informativo',
  SUCCESS: 'Verde',
  WARNING: 'Ambar',
  DANGER: 'Rojo',
  NEUTRAL: 'Neutro',
};

const STATUS_LABELS: Record<CategoryStatus, string> = {
  ACTIVE: 'Activa',
  INACTIVE: 'Inactiva',
};

const EMPTY: CreateCategoryFormInput = {
  name: '',
  description: '',
  color: CATEGORY_COLORS.NEUTRAL,
  responseTimeMinutes: '',
  resolutionTimeMinutes: '',
  status: CATEGORY_STATUSES.ACTIVE,
};

/** Campos que la API puede senalar como invalidos. */
const KNOWN_FIELDS = [
  'name',
  'description',
  'color',
  'responseTimeMinutes',
  'resolutionTimeMinutes',
  'status',
] as const;

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Categoria a editar; `null` para alta. */
  category: CategoryWithCounts | null;
}

/**
 * Alta y edicion de categorias.
 *
 * Un unico dialogo cubre ambos casos: los campos son los mismos y mantener dos
 * formularios paralelos solo garantiza que acaben divergiendo.
 */
export function CategoryFormDialog({ open, onOpenChange, category }: CategoryFormDialogProps) {
  const isEdit = category !== null;
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const mutation = isEdit ? updateMutation : createMutation;

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors },
    // El tercer generico fija el tipo que recibe `handleSubmit`: los valores
    // ya transformados por Zod (`'' -> null`, texto -> numero), no los que el
    // usuario escribio.
  } = useForm<CreateCategoryFormInput, unknown, CreateCategoryFormValues>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: EMPTY,
  });

  // Al abrir se rellena con la categoria o se limpia: reutilizar el dialogo sin
  // esto dejaria los datos del registro anterior a la vista.
  useEffect(() => {
    if (!open) return;

    reset(
      category
        ? {
            name: category.name,
            description: category.description ?? '',
            color: category.color,
            responseTimeMinutes: category.responseTimeMinutes ?? '',
            resolutionTimeMinutes: category.resolutionTimeMinutes ?? '',
            status: category.status,
          }
        : EMPTY,
    );
  }, [open, category, reset]);

  const onSubmit = handleSubmit((values) => {
    const payload = {
      name: values.name,
      description: values.description ?? null,
      color: values.color,
      responseTimeMinutes: values.responseTimeMinutes ?? null,
      resolutionTimeMinutes: values.resolutionTimeMinutes ?? null,
      status: values.status,
    };

    const onError = (error: unknown) => {
      if (!applyApiFieldErrors(error, setError, KNOWN_FIELDS)) {
        notify.fromError(error, 'No se pudo guardar la categoria.');
      }
    };

    if (isEdit) {
      updateMutation.mutate(
        { id: category.id, input: payload },
        { onSuccess: () => onOpenChange(false), onError },
      );
    } else {
      createMutation.mutate(payload, { onSuccess: () => onOpenChange(false), onError });
    }
  });

  return (
    <Dialog open={open} onOpenChange={mutation.isPending ? undefined : onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar categoria' : 'Nueva categoria'}</DialogTitle>
          <DialogDescription>
            Clasifica las incidencias y define los tiempos objetivo de atencion.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="contents">
          <DialogBody className="flex flex-col gap-5">
            <Field label="Nombre" error={errors.name?.message} required>
              {(field) => (
                <Input
                  {...field}
                  {...register('name')}
                  placeholder="Hosting y dominios"
                  invalid={Boolean(errors.name)}
                />
              )}
            </Field>

            <Field
              label="Descripcion"
              error={errors.description?.message}
              hint="Que tipo de incidencias entran en esta categoria."
            >
              {(field) => (
                <Textarea
                  {...field}
                  {...register('description')}
                  rows={3}
                  invalid={Boolean(errors.description)}
                />
              )}
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Color" error={errors.color?.message}>
                {(field) => (
                  <Controller
                    control={control}
                    name="color"
                    render={({ field: select }) => (
                      <Select value={select.value} onValueChange={select.onChange}>
                        <SelectTrigger id={field.id} aria-describedby={field['aria-describedby']}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(CATEGORY_COLORS).map((color) => (
                            <SelectItem key={color} value={color}>
                              {COLOR_LABELS[color]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
              </Field>

              <Field label="Estado" error={errors.status?.message}>
                {(field) => (
                  <Controller
                    control={control}
                    name="status"
                    render={({ field: select }) => (
                      <Select value={select.value} onValueChange={select.onChange}>
                        <SelectTrigger id={field.id} aria-describedby={field['aria-describedby']}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(CATEGORY_STATUSES).map((status) => (
                            <SelectItem key={status} value={status}>
                              {STATUS_LABELS[status]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Primera respuesta"
                error={errors.responseTimeMinutes?.message}
                hint="Minutos objetivo"
              >
                {(field) => (
                  <Input
                    {...field}
                    {...register('responseTimeMinutes')}
                    type="number"
                    min={5}
                    placeholder="60"
                    invalid={Boolean(errors.responseTimeMinutes)}
                  />
                )}
              </Field>

              <Field
                label="Resolucion"
                error={errors.resolutionTimeMinutes?.message}
                hint="Minutos objetivo"
              >
                {(field) => (
                  <Input
                    {...field}
                    {...register('resolutionTimeMinutes')}
                    type="number"
                    min={5}
                    placeholder="480"
                    invalid={Boolean(errors.resolutionTimeMinutes)}
                  />
                )}
              </Field>
            </div>
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
              {isEdit ? 'Guardar cambios' : 'Crear categoria'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
