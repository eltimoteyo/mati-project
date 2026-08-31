'use client';

import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { dashboardService } from '@/services/dashboard.service';

/**
 * Resumen del panel.
 *
 * Se revalida al volver a la pestana porque es una vista de estado operativo:
 * si el usuario vuelve tras un rato, esperar cifras actualizadas es lo natural.
 */
export function useDashboardSummary() {
  return useQuery({
    queryKey: queryKeys.dashboard.summary(),
    queryFn: () => dashboardService.summary(),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}
