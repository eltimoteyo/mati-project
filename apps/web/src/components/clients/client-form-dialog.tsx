'use client';

import { CLIENT_STATUSES, type ClientStatus, type ClientWithCounts } from '@conit/types';
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
  type CreateClientFormInput,
  type CreateClientFormValues,
  createClientSchema,
} from '@conit/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { useCreateClient, useUpdateClient } from '@/hooks/use-clients';
import { applyApiFieldErrors } from '@/lib/form-errors';
import { notify } from '@/lib/notify';

const STATUS_LABELS: Record<ClientStatus, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
};

const EMPTY: CreateClientFormInput = {
  name: '',
  email: '',
  taxId: '',
  contactName: '',
  phone: '',
  address: '',
  notes: '',
  status: CLIENT_STATUSES.ACTIVE,
};

const KNOWN_FIELDS = [
  'name',
  'email',
  'taxId',
  'contactName',
  'phone',
  'address',
  'notes',
  'status',
] as const;

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: ClientWithCounts | null;
}

/** Alta y edicion de clientes. */
export function ClientFormDialog({ open, onOpenChange, client }: ClientFormDialogProps) {
  const isEdit = client !== null;
  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();
  const mutation = isEdit ? updateMutation : createMutation;

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors },
  } = useForm<CreateClientFormInput, unknown, CreateClientFormValues>({
    resolver: zodResolver(createClientSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!open) return;

    reset(
      client
        ? {
            name: client.name,
            email: client.email,
            taxId: client.taxId ?? '',
            contactName: client.contactName ?? '',
            phone: client.phone ?? '',
            address: client.address ?? '',
            notes: client.notes ?? '',
            status: client.status,
          }
        : EMPTY,
    );
  }, [open, client, reset]);

  const onSubmit = handleSubmit((values) => {
    const onError = (error: unknown) => {
      if (!applyApiFieldErrors(error, setError, KNOWN_FIELDS)) {
        notify.fromError(error, 'No se pudo guardar el cliente.');
      }
    };

    if (isEdit) {
      updateMutation.mutate(
        { id: client.id, input: values },
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
          <DialogTitle>{isEdit ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
          <DialogDescription>
            Datos de la empresa y de su contacto principal de soporte.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="contents">
          <DialogBody className="flex flex-col gap-5">
            <Field label="Razon social o nombre" error={errors.name?.message} required>
              {(field) => (
                <Input
                  {...field}
                  {...register('name')}
                  placeholder="Distribuidora Andina S.A.C."
                  invalid={Boolean(errors.name)}
                />
              )}
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Correo electronico" error={errors.email?.message} required>
                {(field) => (
                  <Input
                    {...field}
                    {...register('email')}
                    type="email"
                    inputMode="email"
                    placeholder="contacto@empresa.com"
                    invalid={Boolean(errors.email)}
                  />
                )}
              </Field>

              <Field
                label="Identificador fiscal"
                error={errors.taxId?.message}
                hint="RUC o equivalente"
              >
                {(field) => (
                  <Input
                    {...field}
                    {...register('taxId')}
                    placeholder="20123456789"
                    invalid={Boolean(errors.taxId)}
                  />
                )}
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Persona de contacto" error={errors.contactName?.message}>
                {(field) => (
                  <Input
                    {...field}
                    {...register('contactName')}
                    placeholder="Maria Quispe"
                    invalid={Boolean(errors.contactName)}
                  />
                )}
              </Field>

              <Field label="Telefono" error={errors.phone?.message}>
                {(field) => (
                  <Input
                    {...field}
                    {...register('phone')}
                    type="tel"
                    placeholder="+51 987 654 321"
                    invalid={Boolean(errors.phone)}
                  />
                )}
              </Field>
            </div>

            <Field label="Direccion" error={errors.address?.message}>
              {(field) => (
                <Input {...field} {...register('address')} invalid={Boolean(errors.address)} />
              )}
            </Field>

            <Field
              label="Notas internas"
              error={errors.notes?.message}
              hint="Visibles solo para el equipo de soporte."
            >
              {(field) => (
                <Textarea
                  {...field}
                  {...register('notes')}
                  rows={3}
                  invalid={Boolean(errors.notes)}
                />
              )}
            </Field>

            <Field
              label="Estado"
              error={errors.status?.message}
              hint="Un cliente inactivo no aparece en los selectores."
            >
              {(field) => (
                <Controller
                  control={control}
                  name="status"
                  render={({ field: select }) => (
                    <Select value={select.value} onValueChange={select.onChange}>
                      <SelectTrigger
                        id={field.id}
                        aria-describedby={field['aria-describedby']}
                        className="sm:max-w-xs"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(CLIENT_STATUSES).map((status) => (
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
              {isEdit ? 'Guardar cambios' : 'Crear cliente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
