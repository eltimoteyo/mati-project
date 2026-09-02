'use client';

import type { GrantPortalAccessInput } from '@conit/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notify } from '@/lib/notify';
import { queryKeys } from '@/lib/query-keys';
import { portalAccessService } from '@/services/portal-access.service';

export function usePortalAccess(clientId: string | null) {
  return useQuery({
    queryKey: queryKeys.clients.portalAccess(clientId ?? ''),
    queryFn: () => portalAccessService.get(clientId ?? ''),
    enabled: Boolean(clientId),
  });
}

/**
 * Avisa segun lo que haya pasado con el correo.
 *
 * Se distingue a proposito entre "concedido y enviado" y "concedido pero el
 * correo no salio": en el segundo caso hay que entregar la contrasena a mano,
 * y decir solo "concedido" dejaria al cliente esperando un correo que no llega.
 */
function notifyResult(
  access: { email: { sent: boolean; reason?: string } | null },
  base: string,
): void {
  if (!access.email) {
    notify.success(base);

    return;
  }

  if (access.email.sent) {
    notify.success(base, { description: 'Le hemos enviado las credenciales por correo.' });

    return;
  }

  notify.warning(`${base}, pero el correo no se envio`, {
    description: `${access.email.reason ?? 'Envio no disponible'}. Entrega la contrasena por otro medio.`,
  });
}

export function useGrantPortalAccess(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: GrantPortalAccessInput) => portalAccessService.grant(clientId, input),
    onSuccess: (access) => {
      queryClient.setQueryData(queryKeys.clients.portalAccess(clientId), access);
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      notifyResult(access, 'Acceso al portal concedido');
    },
    onError: (error) => {
      notify.fromError(error, 'No pudimos conceder el acceso.');
    },
  });
}

export function useResendPortalCredentials(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => portalAccessService.resend(clientId),
    onSuccess: (access) => {
      queryClient.setQueryData(queryKeys.clients.portalAccess(clientId), access);
      notifyResult(access, 'Contrasena restablecida');
    },
    onError: (error) => {
      notify.fromError(error, 'No pudimos restablecer la contrasena.');
    },
  });
}

export function useRevokePortalAccess(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => portalAccessService.revoke(clientId),
    onSuccess: (access) => {
      queryClient.setQueryData(queryKeys.clients.portalAccess(clientId), access);
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      notify.success('Acceso al portal retirado');
    },
    onError: (error) => {
      notify.fromError(error, 'No pudimos retirar el acceso.');
    },
  });
}
