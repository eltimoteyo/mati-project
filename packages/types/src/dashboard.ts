import type { ServiceType } from './project';
import type { Ticket, TicketStatus } from './ticket';

/**
 * Resumen del panel.
 *
 * Es una vista de solo lectura, agregada en el servidor: enviar los tickets en
 * crudo para contarlos en el navegador no escalaria y expondria informacion que
 * la vista no necesita.
 */

export interface DashboardMetric {
  /** Estado al que corresponde la cifra, o `CRITICAL` para los criticos. */
  key: TicketStatus | 'CRITICAL';
  value: number;
  /**
   * Variacion porcentual frente al periodo anterior de igual duracion.
   * `null` cuando no hay datos previos con los que comparar (evita mostrar
   * un enganoso "+100 %" la primera semana de uso).
   */
  delta: number | null;
}

export interface TicketVolumePoint {
  /** Fecha del dia en formato ISO (`YYYY-MM-DD`). */
  date: string;
  created: number;
  resolved: number;
}

export interface ServiceDistributionItem {
  type: ServiceType;
  count: number;
  /** Porcentaje sobre el total, redondeado a un decimal. */
  percentage: number;
}

export interface DashboardSummary {
  metrics: DashboardMetric[];
  volume: TicketVolumePoint[];
  distribution: ServiceDistributionItem[];
  recentTickets: Ticket[];
  /** Totales de contexto para las vistas de listado. */
  totals: {
    clients: number;
    projects: number;
    openTickets: number;
  };
}
