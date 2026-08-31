'use client';

import type { AuditFilters } from '@conit/types';
import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { auditService } from '@/services/audit.service';

export function useAuditEntries(filters: AuditFilters) {
  return useQuery({
    queryKey: queryKeys.audit.list(filters),
    queryFn: () => auditService.list(filters),
    placeholderData: (previous) => previous,
  });
}

/**
 * Resumen del periodo.
 *
 * Recibe los mismos filtros que el listado menos la paginacion: el resumen
 * habla del conjunto filtrado, no de la pagina que se esta viendo.
 */
export function useAuditSummary(filters: AuditFilters) {
  const { page: _page, pageSize: _pageSize, ...scope } = filters;

  return useQuery({
    queryKey: queryKeys.audit.summary(scope),
    queryFn: () => auditService.summary(scope),
    placeholderData: (previous) => previous,
  });
}
