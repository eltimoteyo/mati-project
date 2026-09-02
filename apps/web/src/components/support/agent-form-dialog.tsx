'use client';

import {
  type PublicUser,
  USER_ROLES,
  USER_STATUSES,
  type UserRole,
  type UserStatus,
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
} from '@conit/ui';
import { createUserSchema, VALIDATION_RULES } from '@conit/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { type z } from 'zod';

import { useCreateUser, useUpdateUser } from '@/hooks/use-users';
import { applyApiFieldErrors } from '@/lib/form-errors';
import { notify } from '@/lib/notify';

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Soporte (accede al panel)',
  CLIENT: 'Cliente (sin acceso al panel)',
};

const STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
};

const KNOWN_FIELDS = ['name', 'email', 'password', 'role', 'status'] as const;

/**
 * Esquema del formulario.
 *
 * El correo y la contrasena son opcionales en el tipo porque la edicion no los
 * pide; que sean obligatorios en el alta lo impone la comprobacion de abajo.
 * Un unico esquema evita que el formulario cambie de forma entre modos, que es
 * lo que TypeScript no puede reconciliar.
 */
const agentFormSchema = createUserSchema
  .partial({ email: true, password: true })
  .superRefine((values, ctx) => {
    if (values.email === undefined && values.password === undefined) return;

    if (!values.email) {
      ctx.addIssue({ code: 'custom', path: ['email'], message: 'El correo es obligatorio.' });
    }

    if (!values.password) {
      ctx.addIssue({
        code: 'custom',
        path: ['password'],
        message: 'La contrasena inicial es obligatoria.',
      });
    }
  });

type AgentFormInput = z.input<typeof agentFormSchema>;
type AgentFormValues = z.output<typeof agentFormSchema>;

const EMPTY: AgentFormInput = {
  name: '',
  email: '',
  password: '',
  role: USER_ROLES.ADMIN,
  status: USER_STATUSES.ACTIVE,
};

interface AgentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Usuario a editar; `null` para alta. */
  user: PublicUser | null;
}

/**
 * Alta y edicion de miembros del equipo.
 *
 * En la edicion se ocultan el correo y la contrasena: el correo identifica la
 * cuenta y no se reasigna, y la contrasena se restablece desde su propia
 * accion, que ademas cierra las sesiones abiertas del titular.
 */
export function AgentFormDialog({ open, onOpenChange, user }: AgentFormDialogProps) {
  const isEdit = user !== null;
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const mutation = isEdit ? updateMutation : createMutation;

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors },
  } = useForm<AgentFormInput, unknown, AgentFormValues>({
    resolver: zodResolver(agentFormSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!open) return;

    reset(
      user
        ? { name: user.name, role: user.role, status: user.status }
        : EMPTY,
    );
  }, [open, user, reset]);

  const onSubmit = handleSubmit((values) => {
    const onError = (error: unknown) => {
      if (!applyApiFieldErrors(error, setError, KNOWN_FIELDS)) {
        notify.fromError(error, 'No se pudo guardar el usuario.');
      }
    };

    const onSuccess = () => onOpenChange(false);

    if (isEdit) {
      updateMutation.mutate(
        { id: user.id, input: { name: values.name, role: values.role, status: values.status } },
        { onSuccess, onError },
      );

      return;
    }

    // El esquema ya garantiza que ambos llegan en el alta; la comprobacion
    // existe para que el tipo lo refleje sin recurrir a una asercion.
    if (!values.email || !values.password) return;

    createMutation.mutate(
      {
        name: values.name,
        email: values.email,
        password: values.password,
        role: values.role,
        status: values.status,
      },
      { onSuccess, onError },
    );
  });

  return (
    <Dialog open={open} onOpenChange={mutation.isPending ? undefined : onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar usuario' : 'Nuevo miembro del equipo'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'El correo no se puede cambiar: es la identidad de la cuenta.'
              : 'La contrasena inicial la comunicas tu; el titular la cambiara desde Configuracion.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="contents">
          <DialogBody className="flex flex-col gap-5">
            <Field label="Nombre" error={errors.name?.message} required>
              {(field) => (
                <Input
                  {...field}
                  {...register('name')}
                  placeholder="Ana Martinez"
                  invalid={Boolean(errors.name)}
                />
              )}
            </Field>

            {isEdit ? null : (
              <>
                <Field label="Correo" error={errors.email?.message} required>
                  {(field) => (
                    <Input
                      {...field}
                      {...register('email')}
                      type="email"
                      placeholder="ana@conit.com"
                      autoComplete="off"
                      invalid={Boolean(errors.email)}
                    />
                  )}
                </Field>

                <Field
                  label="Contrasena inicial"
                  error={errors.password?.message}
                  required
                  hint={`Minimo ${VALIDATION_RULES.password.minLength} caracteres.`}
                >
                  {(field) => (
                    <Input
                      {...field}
                      {...register('password')}
                      type="password"
                      autoComplete="new-password"
                      invalid={Boolean(errors.password)}
                    />
                  )}
                </Field>
              </>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Rol" error={errors.role?.message}>
                {(field) => (
                  <Controller
                    control={control}
                    name="role"
                    render={({ field: select }) => (
                      <Select value={select.value} onValueChange={select.onChange}>
                        <SelectTrigger id={field.id} aria-describedby={field['aria-describedby']}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(USER_ROLES).map((value) => (
                            <SelectItem key={value} value={value}>
                              {ROLE_LABELS[value]}
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
                          {Object.values(USER_STATUSES).map((value) => (
                            <SelectItem key={value} value={value}>
                              {STATUS_LABELS[value]}
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
              {isEdit ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
