import type { DashboardSummary } from '@conit/types';

import { apiClient } from '@/lib/api-client';

/** Resumen agregado del panel. */
export const dashboardService = {
  summary(): Promise<DashboardSummary> {
    return apiClient.get<DashboardSummary>('/dashboard/summary');
  },
};
