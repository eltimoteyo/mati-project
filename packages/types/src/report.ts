import type { TicketPriority, TicketStatus } from './ticket';

/* -----------------------------------------------------------------------------
 * Reportes
 * -------------------------------------------------------------------------- */

export interface ReportFilters {
  /** Fechas ISO. Si se omiten se toman los ultimos 30 dias. */
  from?: string;
  to?: string;
  clientId?: string;
  categoryId?: string;
}

/** Periodo efectivamente analizado, ya resuelto por el servidor. */
export interface ReportPeriod {
  from: string;
  to: string;
  days: number;
}

export interface ReportSummary {
  period: ReportPeriod;
  totals: ReportTotals;
  times: ReportTimes;
  volume: ReportVolumePoint[];
  byStatus: ReportCount<TicketStatus>[];
  byPriority: ReportCount<TicketPriority>[];
  byClient: ReportNamedCount[];
  byCategory: ReportNamedCount[];
  byAgent: ReportAgentPerformance[];
}

export interface ReportTotals {
  /** Tickets creados dentro del periodo. */
  created: number;
  /** Tickets resueltos dentro del periodo, se hayan creado cuando se hayan creado. */
  resolved: number;
  /** Abiertos ahora mismo, sin importar el periodo. */
  open: number;
  /** Reabiertos: resueltos y devueltos a un estado abierto. */
  reopened: number;
}

/**
 * Tiempos medios, en minutos.
 *
 * `null` cuando no hay ningun ticket con ese dato en el periodo: mostrar un
 * cero haria creer que se responde al instante.
 */
export interface ReportTimes {
  firstResponseMinutes: number | null;
  resolutionMinutes: number | null;
  /** Porcentaje de tickets que cumplieron el objetivo de su categoria. */
  responseWithinTargetPct: number | null;
  resolutionWithinTargetPct: number | null;
  /** Tickets que se pudieron medir contra un objetivo. */
  measuredAgainstTarget: number;
}

export interface ReportVolumePoint {
  date: string;
  created: number;
  resolved: number;
}

export interface ReportCount<TKey extends string = string> {
  key: TKey;
  count: number;
  percentage: number;
}

export interface ReportNamedCount {
  id: string;
  name: string;
  count: number;
  percentage: number;
}

export interface ReportAgentPerformance {
  id: string;
  name: string;
  /** Asignados durante el periodo. */
  assigned: number;
  /** Resueltos durante el periodo. */
  resolved: number;
  /** Minutos medios de resolucion de sus tickets. `null` si no resolvio ninguno. */
  averageResolutionMinutes: number | null;
}
