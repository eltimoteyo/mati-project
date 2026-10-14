'use client';

import {
  type CreateTicketInput,
  SERVICE_TYPE_LABELS,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  type TicketDetail,
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
  type CreateTicketFormInput,
  type CreateTicketFormValues,
  createTicketSchema,
} from '@conit/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import type { UseMutationResult } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { useCategoryOptions } from '@/hooks/use-categories';
import { useClientOptions } from '@/hooks/use-clients';
import { useProjectOptions } from '@/hooks/use-projects';
import { useAssignableUsers, useCreateTicket, useUpdateTicket } from '@/hooks/use-tickets';
import { applyApiFieldErrors } from '@/lib/form-errors';
import { notify } from '@/lib/notify';

/** Valor del selector que representa "sin asignar". */
const NONE = '__none__';

const EMPTY: CreateTicketFormInput = {
  subject: '',
  description: '',
  clientId: '',
  projectId: '',
  categoryId: '',
  assigneeId: '',
  priority: TICKET_PRIORITIES.MEDIUM,
};

const KNOWN_FIELDS = [
  'subject',
  'description',
  'clientId',
  'projectId',
  'categoryId',
  'assigneeId',
  'priority',
] as const;

interface TicketFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ticket a editar; `null` para alta. */
  ticket?: TicketDetail | null;
  /** Navega al detalle tras crear. */
  navigateOnCreate?: boolean;
  /**
   * Valores con los que arranca el alta (por ejemplo, desde un chat).
   *
   * Se aplican al abrir; quien llama debe mantener la misma referencia
   * mientras el dialogo esta abierto o se perderia lo que se haya escrito.
   */
  initialValues?: Partial<CreateTicketFormInput>;
  /** Alta alternativa al endpoint de tickets (la bandeja enlaza la conversacion). */
  createMutation?: UseMutationResult<TicketDetail, Error, CreateTicketInput>;
  /** Sustituye la descripcion del encabezado. */
  description?: string;
}

/**
 * Alta y edicion de incidencias.
 *
 * El selector de servicio depende del cliente elegido y se recarga al
 * cambiarlo: la API rechaza un servicio que pertenezca a otro cliente, asi que
 * la interfaz solo ofrece opciones validas en lugar de dejar que el usuario
 * descubra el error al enviar.
 */
export function TicketFormDialog({
  open,
  onOpenChange,
  ticket = null,
  navigateOnCreate = false,
  initialValues,
  createMutation: customCreate,
  description,
}: TicketFormDialogProps) {
  const router = useRouter();
  const isEdit = ticket !== null;
  const defaultCreate = useCreateTicket();
  const createMutation = customCreate ?? defaultCreate;
  const updateMutation = useUpdateTicket();
  const mutation = isEdit ? updateMutation : createMutation;

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    setError,
    formState: { errors },
  } = useForm<CreateTicketFormInput, unknown, CreateTicketFormValues>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: EMPTY,
  });

  // `useWatch` en lugar de `watch()`: devuelve un valor suscrito en vez de una
  // funcion, de modo que el React Compiler puede memoizar el componente.
  const clientId = useWatch({ control, name: 'clientId' });

  const clientsQuery = useClientOptions(open);
  const categoriesQuery = useCategoryOptions(open);
  const usersQuery = useAssignableUsers(open);
  const projectsQuery = useProjectOptions(clientId || undefined);

  useEffect(() => {
    if (!open) return;

    reset(
      ticket
        ? {
            subject: ticket.subject,
            description: ticket.description,
            clientId: ticket.client.id,
            projectId: ticket.project?.id ?? '',
            categoryId: ticket.category?.id ?? '',
            assigneeId: ticket.assignee?.id ?? '',
            priority: ticket.priority,
          }
        : { ...EMPTY, ...initialValues },
    );
  }, [open, ticket, initialValues, reset]);

  const onSubmit = handleSubmit((values) => {
    const onError = (error: unknown) => {
      if (!applyApiFieldErrors(error, setError, KNOWN_FIELDS)) {
        notify.fromError(error, 'No se pudo guardar el ticket.');
      }
    };

    if (isEdit) {
      const { clientId: _clientId, ...rest } = values;

      updateMutation.mutate(
        { idOrCode: ticket.id, input: rest },
        { onSuccess: () => onOpenChange(false), onError },
      );

      return;
    }

    createMutation.mutate(values, {
      onSuccess: (created) => {
        onOpenChange(false);

        if (navigateOnCreate) {
          router.push(`/admin/tickets/${created.code}`);
        }
      },
      onError,
    });
  });

  return (
    <Dialog open={open} onOpenChange={mutation.isPending ? undefined : onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Editar ${ticket.code}` : 'Nuevo ticket'}</DialogTitle>
          <DialogDescription>
            {description ??
              'Registra la incidencia y asignala al servicio y responsable correspondientes.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="contents">
          <DialogBody className="flex flex-col gap-5">
            <Field label="Asunto" error={errors.subject?.message} required>
              {(field) => (
                <Input
                  {...field}
                  {...register('subject')}
                  placeholder="Certificado SSL proximo a vencer"
                  invalid={Boolean(errors.subject)}
                />
              )}
            </Field>

            <Field
              label="Descripcion"
              error={errors.description?.message}
              required
              hint="Detalla el problema, cuando empezo y como reproducirlo."
            >
              {(field) => (
                <Textarea
                  {...field}
                  {...register('description')}
                  rows={5}
                  invalid={Boolean(errors.description)}
                />
              )}
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Cliente"
                error={errors.clientId?.message}
                required
                hint={isEdit ? 'No se puede cambiar el cliente de un ticket.' : undefined}
              >
                {(field) => (
                  <Controller
                    control={control}
                    name="clientId"
                    render={({ field: select }) => (
                      <Select
                        value={select.value}
                        onValueChange={(value) => {
                          select.onChange(value);
                          // El servicio pertenece al cliente: al cambiarlo, la
                          // seleccion anterior deja de ser valida.
                          setValue('projectId', '');
                        }}
                        disabled={isEdit || clientsQuery.isPending}
                      >
                        <SelectTrigger
                          id={field.id}
                          aria-describedby={field['aria-describedby']}
                          invalid={Boolean(errors.clientId)}
                        >
                          <SelectValue
                            placeholder={
                              clientsQuery.isPending ? 'Cargando…' : 'Selecciona un cliente'
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

              <Field
                label="Servicio afectado"
                error={errors.projectId?.message}
                hint={!clientId ? 'Elige primero un cliente.' : undefined}
              >
                {(field) => (
                  <Controller
                    control={control}
                    name="projectId"
                    render={({ field: select }) => (
                      <Select
                        value={select.value || NONE}
                        onValueChange={(value) => select.onChange(value === NONE ? '' : value)}
                        disabled={!clientId || projectsQuery.isPending}
                      >
                        <SelectTrigger id={field.id} aria-describedby={field['aria-describedby']}>
                          <SelectValue placeholder="Sin especificar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Sin especificar</SelectItem>
                          {(projectsQuery.data ?? []).map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name} · {SERVICE_TYPE_LABELS[project.type]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Categoria" error={errors.categoryId?.message}>
                {(field) => (
                  <Controller
                    control={control}
                    name="categoryId"
                    render={({ field: select }) => (
                      <Select
                        value={select.value || NONE}
                        onValueChange={(value) => select.onChange(value === NONE ? '' : value)}
                      >
                        <SelectTrigger id={field.id} aria-describedby={field['aria-describedby']}>
                          <SelectValue placeholder="Sin clasificar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Sin clasificar</SelectItem>
                          {(categoriesQuery.data ?? []).map((category) => (
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

              <Field label="Responsable" error={errors.assigneeId?.message}>
                {(field) => (
                  <Controller
                    control={control}
                    name="assigneeId"
                    render={({ field: select }) => (
                      <Select
                        value={select.value || NONE}
                        onValueChange={(value) => select.onChange(value === NONE ? '' : value)}
                      >
                        <SelectTrigger id={field.id} aria-describedby={field['aria-describedby']}>
                          <SelectValue placeholder="Sin asignar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Sin asignar</SelectItem>
                          {(usersQuery.data ?? []).map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
              </Field>

              <Field label="Prioridad" error={errors.priority?.message}>
                {(field) => (
                  <Controller
                    control={control}
                    name="priority"
                    render={({ field: select }) => (
                      <Select value={select.value} onValueChange={select.onChange}>
                        <SelectTrigger id={field.id} aria-describedby={field['aria-describedby']}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(TICKET_PRIORITIES).map((priority) => (
                            <SelectItem key={priority} value={priority}>
                              {TICKET_PRIORITY_LABELS[priority]}
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
              {isEdit ? 'Guardar cambios' : 'Crear ticket'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
