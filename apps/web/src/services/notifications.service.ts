import type {
  Notification,
  NotificationCount,
  NotificationFilters,
  NotificationPreference,
  NotificationType,
  PaginatedData,
} from '@conit/types';

import { apiClient } from '@/lib/api-client';
import { toQueryString } from '@/lib/query-string';

/** Avisos del usuario autenticado. Ninguna ruta acepta otro usuario. */
export const notificationsService = {
  list(filters: NotificationFilters = {}): Promise<PaginatedData<Notification>> {
    return apiClient.get<PaginatedData<Notification>>(`/notifications${toQueryString(filters)}`);
  },

  count(): Promise<NotificationCount> {
    return apiClient.get<NotificationCount>('/notifications/count');
  },

  markRead(id: string): Promise<Notification> {
    return apiClient.patch<Notification>(`/notifications/${id}/read`);
  },

  markAllRead(): Promise<NotificationCount> {
    return apiClient.post<NotificationCount>('/notifications/read-all', {});
  },

  remove(id: string): Promise<null> {
    return apiClient.delete<null>(`/notifications/${id}`);
  },

  preferences(): Promise<NotificationPreference[]> {
    return apiClient.get<NotificationPreference[]>('/notifications/preferences');
  },

  setPreference(type: NotificationType, enabled: boolean): Promise<NotificationPreference[]> {
    return apiClient.patch<NotificationPreference[]>('/notifications/preferences', {
      type,
      enabled,
    });
  },
};
