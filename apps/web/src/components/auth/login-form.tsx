'use client';

import { Button, Checkbox, cn, Input, Label } from '@conit/ui';
import { type LoginFormInput, type LoginFormValues, loginSchema } from '@conit/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { useLogin } from '@/hooks/use-login';

interface LoginFormProps {
  /** Ruta interna a la que volver tras iniciar sesion. */
  redirectTo?: string;
}

/**
 * Formulario de inicio de sesion.
 *
 * Valida en el cliente con el mismo esquema que usa la API (`@conit/validation`),
 * de modo que el usuario ve el error antes de enviar y el servidor sigue
 * siendo la autoridad final.
 */
export function LoginForm({ redirectTo }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const emailId = useId();
  const passwordId = useId();
  const rememberId = useId();

  const login = useLogin(redirectTo);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormInput, unknown, LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const isBusy = isSubmitting || login.isPending;

  // Se usa `mutate` y no `mutateAsync`: este ultimo devuelve una promesa que
  // se rechaza al fallar el login y que `handleSubmit` no captura, generando
  // un "unhandled rejection" en consola en cada intento incorrecto. El error
  // ya se comunica al usuario desde el `onError` del hook.
  const onSubmit = handleSubmit((values) => {
    login.mutate({
      email: values.email,
      password: values.password,
      rememberMe: values.rememberMe,
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {/* Correo electronico */}
      <div className="flex flex-col gap-2">
        <Label htmlFor={emailId}>Correo electronico</Label>
        <Input
          id={emailId}
          type="email"
          inputMode="email"
          autoComplete="username"
          placeholder="nombre@empresa.com"
          disabled={isBusy}
          invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? `${emailId}-error` : undefined}
          {...register('email')}
        />
        {errors.email ? (
          <p id={`${emailId}-error`} role="alert" className="text-xs text-destructive">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      {/* Contrasena */}
      <div className="flex flex-col gap-2">
        <Label htmlFor={passwordId}>Contrasena</Label>
        <div className="relative">
          <Input
            id={passwordId}
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            disabled={isBusy}
            invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? `${passwordId}-error` : undefined}
            className="pr-10"
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            disabled={isBusy}
            // El control es decorativo respecto al valor del campo: se anuncia
            // su accion, no el contenido de la contrasena.
            aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
            aria-pressed={showPassword}
            className={cn(
              'absolute inset-y-0 right-0 flex w-10 items-center justify-center',
              'rounded-r-md text-muted-foreground transition-colors',
              'hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/22',
              'disabled:pointer-events-none disabled:opacity-50',
            )}
          >
            {showPassword ? (
              <EyeOffIcon className="size-4" aria-hidden="true" />
            ) : (
              <EyeIcon className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {errors.password ? (
          <p id={`${passwordId}-error`} role="alert" className="text-xs text-destructive">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      {/* Recordarme */}
      <div className="flex items-center gap-2.5">
        <Controller
          control={control}
          name="rememberMe"
          render={({ field }) => (
            <Checkbox
              id={rememberId}
              checked={field.value ?? false}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              disabled={isBusy}
            />
          )}
        />
        <Label htmlFor={rememberId} className="cursor-pointer text-sm font-normal">
          Recordarme
        </Label>
      </div>

      <Button type="submit" size="lg" block loading={isBusy} loadingText="Verificando…">
        Iniciar sesion
      </Button>
    </form>
  );
}
