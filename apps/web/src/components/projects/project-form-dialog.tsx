'use client';

import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  type ProjectWithClient,
  SERVICE_TYPE_LABELS,
  SERVICE_TYPES,
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
  type CreateProjectFormInput,
  type CreateProjectFormValues,
  createProjectSchema,
} from '@conit/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { useClientOptions } from '@/hooks/use-clients';
import { useCreateProject, useUpdateProject } from '@/hooks/use-projects';
import { applyApiFieldErrors } from '@/lib/form-errors';
import { notify } from '@/lib/notify';

/** Los `<input type="date">` trabajan con `YYYY-MM-DD`. */
function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : '';
}

const EMPTY: CreateProjectFormInput = {
  clientId: '',
  name: '',
  type: SERVICE_TYPES.WEBSITE,
  description: '',
  url: '',
  status: PROJECT_STATUSES.ACTIVE,
  startedAt: '',
  expiresAt: '',
};

const KNOWN_FIELDS = [
  'clientId',
  'name',
  'type',
  'description',
  'url',
  'status',
  'startedAt',
  'expiresAt',
] as const;

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectWithClient | null;
  /** Cliente preseleccionado al crear desde la ficha de un cliente. */
  defaultClientId?: string;
}

/**
 * Alta y edicion de proyectos y servicios.
 *
 * Al editar, el cliente queda bloqueado: mover un servicio a otra empresa
 * arrastraria sus tickets al historial equivocado.
 */
export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  defaultClientId,
}: ProjectFormDialogProps) {
  const isEdit = project !== null;
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
  const mutation = isEdit ? updateMutation : createMutation;

  const clientsQuery = useClientOptions(open);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors },
  } = useForm<CreateProjectFormInput, unknown, CreateProjectFormValues>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!open) return;

    reset(
      project
        ? {
            clientId: project.clientId,
            name: project.name,
            type: project.type,
            description: project.description ?? '',
            url: project.url ?? '',
            status: project.status,
            startedAt: toDateInput(project.startedAt),
            expiresAt: toDateInput(project.expiresAt),
          }
        : { ...EMPTY, clientId: defaultClientId ?? '' },
    );
  }, [open, project, defaultClientId, reset]);

  const onSubmit = handleSubmit((values) => {
    const onError = (error: unknown) => {
      if (!applyApiFieldErrors(error, setError, KNOWN_FIELDS)) {
        notify.fromError(error, 'No se pudo guardar el servicio.');
      }
    };

    if (isEdit) {
      const { clientId: _clientId, ...rest } = values;

      updateMutation.mutate(
        { id: project.id, input: rest },
        { onSuccess: () => onOpenChange(false), onError },
      );
    } else {
      createMutation.mutate(values, { onSuccess: () => onOpenChange(false), onError });
    }
  });

  return (
    <Dialog open={open} onOpenChange={mutation.isPending ? undefined : onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar servicio' : 'Nuevo servicio'}</DialogTitle>
          <DialogDescription>
            Paginas, sistemas, aulas virtuales, hosting, dominios, correo o bases de datos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="contents">
          <DialogBody className="flex flex-col gap-5">
            <Field
              label="Cliente"
              error={errors.clientId?.message}
              required
              hint={isEdit ? 'No se puede cambiar el cliente de un servicio existente.' : undefined}
            >
              {(field) => (
                <Controller
                  control={control}
                  name="clientId"
                  render={({ field: select }) => (
                    <Select
                      value={select.value}
                      onValueChange={select.onChange}
                      disabled={isEdit || clientsQuery.isPending}
                    >
                      <SelectTrigger
                        id={field.id}
                        aria-describedby={field['aria-describedby']}
                        invalid={Boolean(errors.clientId)}
                      >
                        <SelectValue
                          placeholder={
                            clientsQuery.isPending ? 'Cargando clientes…' : 'Selecciona un cliente'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {(clientsQuery.data ?? []).map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Nombre del servicio" error={errors.name?.message} required>
                {(field) => (
                  <Input
                    {...field}
                    {...register('name')}
                    placeholder="Portal institucional"
                    invalid={Boolean(errors.name)}
                  />
                )}
              </Field>

              <Field label="Tipo" error={errors.type?.message} required>
                {(field) => (
                  <Controller
                    control={control}
                    name="type"
                    render={({ field: select }) => (
                      <Select value={select.value} onValueChange={select.onChange}>
                        <SelectTrigger id={field.id} aria-describedby={field['aria-describedby']}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(SERVICE_TYPES).map((type) => (
                            <SelectItem key={type} value={type}>
                              {SERVICE_TYPE_LABELS[type]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
              </Field>
            </div>

            <Field
              label="URL o dominio"
              error={errors.url?.message}
              hint="Debe incluir http:// o https://"
            >
              {(field) => (
                <Input
                  {...field}
                  {...register('url')}
                  type="url"
                  placeholder="https://cliente.com"
                  invalid={Boolean(errors.url)}
                />
              )}
            </Field>

            <Field label="Descripcion" error={errors.description?.message}>
              {(field) => (
                <Textarea
                  {...field}
                  {...register('description')}
                  rows={3}
                  invalid={Boolean(errors.description)}
                />
              )}
            </Field>

            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Inicio" error={errors.startedAt?.message}>
                {(field) => (
                  <Input
                    {...field}
                    {...register('startedAt')}
                    type="date"
                    invalid={Boolean(errors.startedAt)}
                  />
                )}
              </Field>

              <Field
                label="Vencimiento"
                error={errors.expiresAt?.message}
                hint="Hosting y dominios"
              >
                {(field) => (
                  <Input
                    {...field}
                    {...register('expiresAt')}
                    type="date"
                    invalid={Boolean(errors.expiresAt)}
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
                          {Object.values(PROJECT_STATUSES).map((status) => (
                            <SelectItem key={status} value={status}>
                              {PROJECT_STATUS_LABELS[status]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
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
              {isEdit ? 'Guardar cambios' : 'Registrar servicio'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
