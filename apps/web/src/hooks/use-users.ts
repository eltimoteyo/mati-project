'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notify } from '@/lib/notify';
import { queryKeys } from '@/lib/query-keys';
import {
  type CreateUserInput,
  type UpdateUserInput,
  type UserListQuery,
  usersService,
} from '@/services/users.service';

export function useUsers(query: UserListQuery) {
  return useQuery({
    queryKey: queryKeys.users.list(query),
    queryFn: () => usersService.list(query),
    placeholderData: (previous) => previous,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateUserInput) => usersService.create(input),
    onSuccess: (user) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      notify.success('Usuario creado', { description: user.email });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
      usersService.update(id, input),
    onSuccess: (user) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      notify.success('Usuario actualizado', { description: user.name });
    },
    onError: (error) => {
      // Incluye el bloqueo del ultimo administrador y el de la cuenta propia.
      notify.fromError(error, 'No se pudo actualizar el usuario.');
    },
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      usersService.resetPassword(id, password),
    onSuccess: () => {
      notify.success('Contrasena restablecida', {
        description: 'Se han cerrado sus sesiones abiertas.',
      });
    },
    onError: (error) => {
      notify.fromError(error, 'No se pudo restablecer la contrasena.');
    },
  });
}
