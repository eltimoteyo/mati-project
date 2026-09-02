'use client';

import type { PublicUser } from '@conit/types';
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
} from '@conit/ui';
import {
  type ResetUserPasswordFormValues,
  resetUserPasswordSchema,
  VALIDATION_RULES,
} from '@conit/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { useResetUserPassword } from '@/hooks/use-users';

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: PublicUser | null;
}

/**
 * Restablecimiento de la contrasena de otro usuario.
 *
 * Se avisa de que cerrara sus sesiones porque es una consecuencia que el
 * administrador debe conocer antes de confirmar, no despues.
 */
export function ResetPasswordDialog({ open, onOpenChange, user }: ResetPasswordDialogProps) {
  const mutation = useResetUserPassword();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ResetUserPasswordFormValues>({
    resolver: zodResolver(resetUserPasswordSchema),
    defaultValues: { password: '' },
  });

  useEffect(() => {
    if (open) reset({ password: '' });
  }, [open, reset]);

  const onSubmit = handleSubmit((values) => {
    if (!user) return;

    mutation.mutate(
      { id: user.id, password: values.password },
      { onSuccess: () => onOpenChange(false) },
    );
  });

  return (
    <Dialog open={open} onOpenChange={mutation.isPending ? undefined : onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restablecer contrasena</DialogTitle>
          <DialogDescription>
            {user
              ? `Se fijara una contrasena nueva para ${user.name} y se cerraran todas sus sesiones abiertas.`
              : ''}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="contents">
          <DialogBody>
            <Field
              label="Contrasena nueva"
              error={errors.password?.message}
              required
              hint={`Minimo ${VALIDATION_RULES.password.minLength} caracteres. Comunicasela por un canal seguro.`}
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
              Restablecer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
