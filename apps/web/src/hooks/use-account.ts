'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { notify } from '@/lib/notify';
import { queryKeys } from '@/lib/query-keys';
import { accountService } from '@/services/account.service';

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => accountService.updateProfile(name),
    onSuccess: (user) => {
      // Se siembra la sesion con el usuario devuelto: la cabecera muestra el
      // nombre nuevo de inmediato, sin esperar a revalidar.
      queryClient.setQueryData(queryKeys.auth.session(), user);
      notify.success('Perfil actualizado');
    },
    onError: (error) => notify.fromError(error, 'No se pudo actualizar el perfil.'),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ current, next }: { current: string; next: string }) =>
      accountService.changePassword(current, next),
    onSuccess: () => {
      notify.success('Contrasena actualizada', {
        description: 'Se cerraron las sesiones abiertas en otros dispositivos.',
      });
    },
  });
}
