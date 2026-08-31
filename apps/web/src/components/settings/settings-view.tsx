'use client';

import { USER_ROLES } from '@conit/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  Field,
  Input,
  PageLoader,
  Separator,
} from '@conit/ui';
import {
  type ChangePasswordFormValues,
  changePasswordSchema,
  type UpdateProfileFormValues,
  updateProfileSchema,
} from '@conit/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { EyeIcon, EyeOffIcon, MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { PageHeader } from '@/components/common/page-header';
import { useChangePassword, useUpdateProfile } from '@/hooks/use-account';
import { useIsHydrated } from '@/hooks/use-is-hydrated';
import { useSession } from '@/hooks/use-session';
import { applyApiFieldErrors } from '@/lib/form-errors';
import { notify } from '@/lib/notify';

const THEMES = [
  { value: 'light', label: 'Claro', icon: SunIcon },
  { value: 'dark', label: 'Oscuro', icon: MoonIcon },
  { value: 'system', label: 'Sistema', icon: MonitorIcon },
] as const;

/** Campo de contrasena con conmutador de visibilidad. */
function PasswordInput({
  id,
  describedBy,
  invalid,
  registration,
  autoComplete,
  disabled,
}: {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  registration: ReturnType<ReturnType<typeof useForm<ChangePasswordFormValues>>['register']>;
  autoComplete: string;
  disabled: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        aria-describedby={describedBy}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        invalid={invalid}
        disabled={disabled}
        className="pr-10"
        {...registration}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        disabled={disabled}
        aria-label={visible ? 'Ocultar contrasena' : 'Mostrar contrasena'}
        aria-pressed={visible}
        className={cn(
          'absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md',
          'text-muted-foreground transition-colors hover:text-foreground',
          'focus-visible:ring-[3px] focus-visible:ring-ring/22',
          'disabled:pointer-events-none disabled:opacity-50',
        )}
      >
        {visible ? (
          <EyeOffIcon className="size-4" aria-hidden="true" />
        ) : (
          <EyeIcon className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

/**
 * Configuracion de la cuenta.
 *
 * Reune lo que el propio usuario puede cambiar. Los ajustes globales del
 * sistema (correo saliente, integraciones) llegaran cuando existan esos
 * modulos: mostrar controles que no hacen nada seria peor que no mostrarlos.
 */
export function SettingsView() {
  const { user, isLoading } = useSession();
  const isHydrated = useIsHydrated();
  const { theme, setTheme } = useTheme();

  const profileMutation = useUpdateProfile();
  const passwordMutation = useChangePassword();

  const profileForm = useForm<UpdateProfileFormValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: '' },
  });

  const passwordForm = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (user) profileForm.reset({ name: user.name });
  }, [user, profileForm]);

  if (isLoading || !user) {
    return <PageLoader message="Cargando tu cuenta…" />;
  }

  const onSubmitProfile = profileForm.handleSubmit((values) => {
    profileMutation.mutate(values.name);
  });

  const onSubmitPassword = passwordForm.handleSubmit((values) => {
    passwordMutation.mutate(
      { current: values.currentPassword, next: values.newPassword },
      {
        onSuccess: () =>
          passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' }),
        onError: (error) => {
          // Un 401 aqui significa "la actual no coincide", no sesion caducada:
          // se senala en su campo en lugar de mostrar un aviso generico.
          if (!applyApiFieldErrors(error, passwordForm.setError, ['currentPassword'])) {
            passwordForm.setError('currentPassword', {
              type: 'server',
              message: 'La contrasena actual no es correcta.',
            });
            notify.fromError(error, 'No se pudo cambiar la contrasena.');
          }
        },
      },
    );
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuracion"
        description="Datos de tu cuenta, seguridad y preferencias de la interfaz."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* -------------------------------------------------------------- */}
        {/* Perfil                                                           */}
        {/* -------------------------------------------------------------- */}
        <Card>
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle>Perfil</CardTitle>
            <p className="text-sm text-muted-foreground">Como apareces en el sistema.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmitProfile} noValidate className="flex flex-col gap-5">
              <Field label="Nombre" error={profileForm.formState.errors.name?.message} required>
                {(field) => (
                  <Input
                    {...field}
                    {...profileForm.register('name')}
                    invalid={Boolean(profileForm.formState.errors.name)}
                    disabled={profileMutation.isPending}
                  />
                )}
              </Field>

              <Field
                label="Correo electronico"
                hint="Es tu identificador de acceso; no se puede cambiar desde aqui."
              >
                {(field) => <Input {...field} value={user.email} readOnly disabled />}
              </Field>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rol:</span>
                <Badge variant={user.role === USER_ROLES.ADMIN ? 'default' : 'neutral'}>
                  {user.role === USER_ROLES.ADMIN ? 'Administrador' : 'Cliente'}
                </Badge>
              </div>

              <div className="flex justify-end">
                <Button type="submit" loading={profileMutation.isPending} loadingText="Guardando…">
                  Guardar cambios
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* -------------------------------------------------------------- */}
        {/* Seguridad                                                        */}
        {/* -------------------------------------------------------------- */}
        <Card>
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle>Seguridad</CardTitle>
            <p className="text-sm text-muted-foreground">
              Al cambiarla se cierran las sesiones de otros dispositivos.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmitPassword} noValidate className="flex flex-col gap-5">
              <Field
                label="Contrasena actual"
                error={passwordForm.formState.errors.currentPassword?.message}
                required
              >
                {(field) => (
                  <PasswordInput
                    id={field.id}
                    describedBy={field['aria-describedby']}
                    invalid={Boolean(passwordForm.formState.errors.currentPassword)}
                    registration={passwordForm.register('currentPassword')}
                    autoComplete="current-password"
                    disabled={passwordMutation.isPending}
                  />
                )}
              </Field>

              <Field
                label="Nueva contrasena"
                error={passwordForm.formState.errors.newPassword?.message}
                hint="Minimo 8 caracteres."
                required
              >
                {(field) => (
                  <PasswordInput
                    id={field.id}
                    describedBy={field['aria-describedby']}
                    invalid={Boolean(passwordForm.formState.errors.newPassword)}
                    registration={passwordForm.register('newPassword')}
                    autoComplete="new-password"
                    disabled={passwordMutation.isPending}
                  />
                )}
              </Field>

              <Field
                label="Confirmar nueva contrasena"
                error={passwordForm.formState.errors.confirmPassword?.message}
                required
              >
                {(field) => (
                  <PasswordInput
                    id={field.id}
                    describedBy={field['aria-describedby']}
                    invalid={Boolean(passwordForm.formState.errors.confirmPassword)}
                    registration={passwordForm.register('confirmPassword')}
                    autoComplete="new-password"
                    disabled={passwordMutation.isPending}
                  />
                )}
              </Field>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  loading={passwordMutation.isPending}
                  loadingText="Actualizando…"
                >
                  Cambiar contrasena
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Preferencias                                                         */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle>Apariencia</CardTitle>
          <p className="text-sm text-muted-foreground">
            La preferencia se guarda en este navegador.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div
            role="radiogroup"
            aria-label="Tema de la interfaz"
            className="flex flex-wrap gap-2"
          >
            {THEMES.map((option) => {
              const Icon = option.icon;
              // Hasta la hidratacion no se conoce el tema elegido; se evita
              // marcar uno al azar y provocar un salto visual.
              const selected = isHydrated && theme === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium',
                    'transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/22',
                    selected
                      ? 'border-primary/40 bg-primary/8 text-foreground'
                      : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {option.label}
                </button>
              );
            })}
          </div>

          <Separator />

          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <dt className="text-xs font-medium tracking-[0.04em] text-muted-foreground uppercase">
                Ultimo acceso
              </dt>
              <dd className="tabular text-sm">
                {user.lastLoginAt
                  ? format(new Date(user.lastLoginAt), "d 'de' MMMM 'de' yyyy, HH:mm", {
                      locale: es,
                    })
                  : '—'}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs font-medium tracking-[0.04em] text-muted-foreground uppercase">
                Cuenta creada
              </dt>
              <dd className="tabular text-sm">
                {format(new Date(user.createdAt), "d 'de' MMMM 'de' yyyy", { locale: es })}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
