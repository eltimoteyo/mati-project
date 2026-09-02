'use client';

import type { ReportFilters } from '@conit/types';
import { useMutation, useQuery } from '@tanstack/react-query';

import { notify } from '@/lib/notify';
import { queryKeys } from '@/lib/query-keys';
import { reportsService } from '@/services/reports.service';

export function useReport(filters: ReportFilters) {
  return useQuery({
    queryKey: queryKeys.reports.summary(filters),
    queryFn: () => reportsService.summary(filters),
    placeholderData: (previous) => previous,
  });
}

/**
 * Descarga el CSV del periodo.
 *
 * El fichero se materializa en el navegador a partir del blob y el enlace
 * temporal se revoca despues: dejarlo vivo mantendria el fichero en memoria
 * durante toda la sesion.
 */
export function useExportReport() {
  return useMutation({
    mutationFn: async (filters: ReportFilters) => {
      const blob = await reportsService.exportCsv(filters);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);

      link.href = url;
      link.download = `conit-tickets-${stamp}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      notify.success('Exportacion descargada');
    },
    onError: (error) => {
      notify.fromError(error, 'No se pudo exportar el reporte.');
    },
  });
}
