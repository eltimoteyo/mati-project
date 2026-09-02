'use client';

import type { ClientWithCounts } from '@conit/types';
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Separator,
  Skeleton,
} from '@conit/ui';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CopyIcon, KeyRoundIcon, MailIcon, RefreshCwIcon, ShieldOffIcon } from 'lucide-react';
import { useState } from 'react';

import {
  useGrantPortalAccess,
  usePortalAccess,
  useResendPortalCredentials,
  useRevokePortalAccess,
} from '@/hooks/use-portal-access';
import { notify } from '@/lib/notify';

/** Longitud de la contrasena sugerida. Coincide con la que genera el servidor. */
const SUGGESTED_LENGTH = 14;

/** Sin caracteres que se confunden al leerlos de un correo: l, I, 1, O, 0. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/**
 * Contrasena sugerida.
 *
 * Se genera con `crypto.getRandomValues`, no con `Math.random`: este ultimo es
 * predecible y no sirve para proteger una cuenta.
 */
function suggestPassword(): string {
  const values = new Uint32Array(SUGGESTED_LENGTH);
  crypto.getRandomValues(values);

  return [...values].map((value) => ALPHABET[value % ALPHABET.length]).join('');
}

interface PortalAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: ClientWithCounts | null;
}

/**
 * Acceso del cliente a su portal.
 *
 * Reune las tres acciones en un solo sitio porque son la misma decision vista
 * desde tres momentos: dar acceso, volver a comunicarlo y retirarlo.
 */
export function PortalAccessDialog({ open, onOpenChange, client }: PortalAccessDialogProps) {
  const clientId = client?.id ?? '';
  const access = usePortalAccess(open && clientId ? clientId : null);
  const grant = useGrantPortalAccess(clientId);
  const resend = useResendPortalCredentials(clientId);
  const revoke = useRevokePortalAccess(clientId);

  const [password, setPassword] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [wasOpen, setWasOpen] = useState(open);

  // Ajuste de estado durante el render (patron recomendado por React frente a
  // un `useEffect`, que provocaria un render en cascada): al abrir se propone
  // una contrasena, porque quien concede el acceso rara vez quiere inventarse
  // una y la sugerida es mejor que la que escribiria a mano.
  if (open !== wasOpen) {
    setWasOpen(open);

    if (open) {
      setPassword(suggestPassword());
      setSendEmail(true);
    }
  }

  const busy = grant.isPending || resend.isPending || revoke.isPending;
  const enabled = access.data?.enabled ?? false;
  const account = access.data?.user ?? null;

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(password);
      notify.success('Contrasena copiada');
    } catch {
      notify.error('No pudimos copiar. Selecciona el texto y copialo a mano.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Acceso al portal</DialogTitle>
          <DialogDescription>
            {client
              ? `Cuenta con la que ${client.name} entra a ver y reportar sus incidencias.`
              : 'Cuenta del cliente para el portal.'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-5">
          {access.isPending ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <>
              {/* Estado actual ------------------------------------------- */}
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">Estado</span>
                  {enabled ? (
                    <Badge variant="success">Activo</Badge>
                  ) : account ? (
                    <Badge variant="warning">Retirado</Badge>
                  ) : (
                    <Badge variant="neutral">Sin acceso</Badge>
                  )}
                </div>

                {account ? (
                  <>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MailIcon className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{account.email}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {account.lastLoginAt
                        ? `Ultimo acceso: ${format(new Date(account.lastLoginAt), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}`
                        : 'Todavia no ha entrado nunca.'}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    La cuenta se creara con el correo de la ficha del cliente.
                  </span>
                )}
              </div>

              {/* Conceder o restablecer ---------------------------------- */}
              <Field
                label={enabled ? 'Nueva contrasena' : 'Contrasena inicial'}
                hint="Se genera una segura al abrir. Puedes cambiarla si lo prefieres."
              >
                {(field) => (
                  <div className="flex gap-2">
                    <Input
                      {...field}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="font-mono text-sm"
                      autoComplete="off"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Generar otra"
                      onClick={() => setPassword(suggestPassword())}
                    >
                      <RefreshCwIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Copiar contrasena"
                      onClick={() => void copyPassword()}
                    >
                      <CopyIcon />
                    </Button>
                  </div>
                )}
              </Field>

              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox
                  checked={sendEmail}
                  onCheckedChange={(checked) => setSendEmail(checked === true)}
                  className="mt-0.5"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">Enviarle las credenciales por correo</span>
                  <span className="text-xs text-muted-foreground">
                    A {client?.email}. El correo pide cambiar la contrasena al entrar y borrar el
                    mensaje despues.
                  </span>
                </span>
              </label>

              <Button
                type="button"
                loading={grant.isPending}
                loadingText="Guardando…"
                disabled={password.length < 8 || busy}
                onClick={() =>
                  grant.mutate(
                    { password, sendEmail },
                    { onSuccess: () => setPassword(suggestPassword()) },
                  )
                }
              >
                <KeyRoundIcon />
                {enabled ? 'Cambiar la contrasena' : 'Dar acceso al portal'}
              </Button>

              {/* Acciones sobre una cuenta existente --------------------- */}
              {account ? (
                <>
                  <Separator />

                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      loading={resend.isPending}
                      loadingText="Enviando…"
                      disabled={busy}
                      onClick={() => resend.mutate()}
                    >
                      <MailIcon />
                      Generar contrasena nueva y enviarsela
                    </Button>
                    {/* Se explica el porque: "reenviar la actual" es lo que
                        cualquiera esperaria encontrar aqui. */}
                    <p className="text-xs text-muted-foreground">
                      La contrasena actual no se puede reenviar: solo se guarda cifrada. Esto genera
                      una nueva y deja la anterior sin efecto.
                    </p>
                  </div>

                  {enabled ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      loading={revoke.isPending}
                      loadingText="Retirando…"
                      disabled={busy}
                      onClick={() => revoke.mutate()}
                    >
                      <ShieldOffIcon />
                      Retirar el acceso
                    </Button>
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
