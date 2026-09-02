'use client';

import type { NotificationFilters, NotificationType } from '@conit/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notify } from '@/lib/notify';
import { queryKeys } from '@/lib/query-keys';
import { notificationsService } from '@/services/notifications.service';

/** Cada cuanto se refresca el indicador de la campana. */
const COUNT_REFETCH_MS = 60_000;

export function useNotifications(filters: NotificationFilters) {
  return useQuery({
    queryKey: queryKeys.notifications.list(filters),
    queryFn: () => notificationsService.list(filters),
    placeholderData: (previous) => previous,
  });
}

/**
 * Recuento de no leidas.
 *
 * Se refresca cada minuto y al volver a la pestana. No se usa sondeo mas
 * agresivo: un aviso que tarda un minuto en aparecer no rompe nada, y una
 * peticion por segundo por usuario si.
 */
export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.notifications.count(),
    queryFn: () => notificationsService.count(),
    refetchInterval: COUNT_REFETCH_MS,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationsService.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
    onError: (error) => {
      notify.fromError(error, 'No se pudieron marcar como leidas.');
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationsService.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
    onError: (error) => {
      notify.fromError(error, 'No se pudo descartar el aviso.');
    },
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: queryKeys.notifications.preferences(),
    queryFn: () => notificationsService.preferences(),
  });
}

export function useSetNotificationPreference() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ type, enabled }: { type: NotificationType; enabled: boolean }) =>
      notificationsService.setPreference(type, enabled),
    onSuccess: (preferences) => {
      // Se siembra con la respuesta: el servidor devuelve el juego completo,
      // asi que no hace falta volver a pedirlo.
      queryClient.setQueryData(queryKeys.notifications.preferences(), preferences);
      notify.success('Preferencia guardada');
    },
    onError: (error) => {
      notify.fromError(error, 'No se pudo guardar la preferencia.');
    },
  });
}
