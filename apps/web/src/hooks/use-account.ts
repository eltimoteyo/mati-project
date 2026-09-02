'use client';

import type { PortalProfile, PublicUser } from '@conit/types';
import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';

import { notify } from '@/lib/notify';
import { queryKeys } from '@/lib/query-keys';
import { accountService } from '@/services/account.service';

/** Mantiene sincronizadas las dos vistas que contienen la identidad del cliente. */
function updateAccountCaches(queryClient: QueryClient, user: PublicUser): void {
  queryClient.setQueryData(queryKeys.auth.session(), user);
  queryClient.setQueryData<PortalProfile>(queryKeys.portal.profile(), (profile) =>
    profile
      ? {
          ...profile,
          user: {
            ...profile.user,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            lastLoginAt: user.lastLoginAt,
          },
        }
      : profile,
  );
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => accountService.updateProfile(name),
    onSuccess: (user) => {
      updateAccountCaches(queryClient, user);
      notify.success('Perfil actualizado');
    },
    onError: (error) => notify.fromError(error, 'No se pudo actualizar el perfil.'),
  });
}

function useAvatarMutation<TInput>(
  mutationFn: (input: TInput) => Promise<PublicUser>,
  successMessage: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (user) => {
      updateAccountCaches(queryClient, user);
      notify.success(successMessage);
    },
    onError: (error) => notify.fromError(error, 'No se pudo actualizar la foto de perfil.'),
  });
}

export function useUploadAvatar() {
  return useAvatarMutation(
    (file: File) => accountService.uploadAvatar(file),
    'Foto de perfil actualizada',
  );
}

export function useRemoveAvatar() {
  return useAvatarMutation(() => accountService.removeAvatar(), 'Foto de perfil eliminada');
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
