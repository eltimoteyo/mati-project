import type { AuditEntry, AuditFilters, AuditSummary, PaginatedData } from '@conit/types';

import { apiClient } from '@/lib/api-client';
import { toQueryString } from '@/lib/query-string';

/** Historial de auditoria. Solo lectura por diseno. */
export const auditService = {
  list(filters: AuditFilters = {}): Promise<PaginatedData<AuditEntry>> {
    return apiClient.get<PaginatedData<AuditEntry>>(`/audit${toQueryString(filters)}`);
  },

  summary(filters: AuditFilters = {}): Promise<AuditSummary> {
    return apiClient.get<AuditSummary>(`/audit/summary${toQueryString(filters)}`);
  },
};
