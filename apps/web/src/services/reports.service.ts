import type { ReportFilters, ReportSummary } from '@conit/types';

import { apiClient } from '@/lib/api-client';
import { toQueryString } from '@/lib/query-string';

export const reportsService = {
  summary(filters: ReportFilters = {}): Promise<ReportSummary> {
    return apiClient.get<ReportSummary>(`/reports${toQueryString(filters)}`);
  },

  exportCsv(filters: ReportFilters = {}): Promise<Blob> {
    return apiClient.getBlob(`/reports/export${toQueryString(filters)}`);
  },
};
