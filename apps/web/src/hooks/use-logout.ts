'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { siteConfig } from '@/config/site';
import { notify } from '@/lib/notify';
import { authService } from '@/services/auth.service';

/**
 * Cierre de sesion.
 *
 * La cache se limpia tanto si el servidor responde bien como si falla: si la
 * peticion no llega, el usuario igualmente espera quedar desconectado en
 * este dispositivo.
 */
export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const finish = () => {
    queryClient.clear();
    router.replace(siteConfig.routes.login);
    router.refresh();
  };

  return useMutation({
    mutationFn: () => authService.logout(),

    onSuccess: () => {
      notify.success('Sesion cerrada correctamente');
      finish();
    },

    onError: () => {
      notify.warning('Cerramos tu sesion localmente', {
        description: 'No pudimos confirmarlo con el servidor.',
      });
      finish();
    },
  });
}
