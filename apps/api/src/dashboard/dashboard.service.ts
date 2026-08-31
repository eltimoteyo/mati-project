import {
  type DashboardMetric,
  type DashboardSummary,
  OPEN_TICKET_STATUSES,
  type ServiceDistributionItem,
  type ServiceType,
  TICKET_STATUSES,
  type TicketVolumePoint,
} from '@conit/types';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { TICKET_RELATIONS, toTicket } from '../tickets/tickets.mapper';

/** Dias que abarca la serie de volumen del grafico. */
const VOLUME_DAYS = 14;

/** Ventana de comparacion de las variaciones. */
const COMPARISON_DAYS = 7;

/** Tickets mostrados en "actividad reciente". */
const RECENT_LIMIT = 6;

/** Fila devuelta por las consultas de agregacion diaria. */
interface DailyCountRow {
  date: Date;
  count: bigint | number;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(): Promise<DashboardSummary> {
    const [metrics, volume, distribution, recentTickets, totals] = await Promise.all([
      this.buildMetrics(),
      this.buildVolume(),
      this.buildDistribution(),
      this.buildRecentTickets(),
      this.buildTotals(),
    ]);

    return { metrics, volume, distribution, recentTickets, totals };
  }

  /* ---------------------------------------------------------------------------
   * Metricas
   * ------------------------------------------------------------------------ */

  /**
   * Cifras de cabecera.
   *
   * `value` es el recuento actual de la cola (cuantos tickets estan ahora en
   * ese estado). `delta` solo se calcula donde tiene un significado
   * comprobable sin historico de instantaneas:
   *
   *   - NEW      -> variacion de tickets **creados** en los ultimos 7 dias.
   *   - RESOLVED -> variacion de tickets **resueltos** en los ultimos 7 dias.
   *
   * En el resto se devuelve `null`: deducir la variacion de una cola a partir
   * de los datos actuales seria inventarla, y la interfaz oculta el indicador
   * cuando no hay dato.
   */
  private async buildMetrics(): Promise<DashboardMetric[]> {
    const now = new Date();
    const currentFrom = this.daysAgo(now, COMPARISON_DAYS);
    const previousFrom = this.daysAgo(now, COMPARISON_DAYS * 2);

    const [
      byStatus,
      criticalOpen,
      createdCurrent,
      createdPrevious,
      resolvedCurrent,
      resolvedPrevious,
    ] = await Promise.all([
      this.prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.ticket.count({
        where: { priority: 'CRITICAL', status: { in: OPEN_TICKET_STATUSES } },
      }),
      this.prisma.ticket.count({ where: { createdAt: { gte: currentFrom } } }),
      this.prisma.ticket.count({ where: { createdAt: { gte: previousFrom, lt: currentFrom } } }),
      this.prisma.ticket.count({ where: { resolvedAt: { gte: currentFrom } } }),
      this.prisma.ticket.count({ where: { resolvedAt: { gte: previousFrom, lt: currentFrom } } }),
    ]);

    const countFor = (status: string): number =>
      byStatus.find((row) => row.status === status)?._count._all ?? 0;

    return [
      {
        key: TICKET_STATUSES.NEW,
        value: countFor(TICKET_STATUSES.NEW),
        delta: this.percentageChange(createdCurrent, createdPrevious),
      },
      { key: TICKET_STATUSES.IN_REVIEW, value: countFor(TICKET_STATUSES.IN_REVIEW), delta: null },
      {
        key: TICKET_STATUSES.IN_PROGRESS,
        value: countFor(TICKET_STATUSES.IN_PROGRESS),
        delta: null,
      },
      {
        key: TICKET_STATUSES.RESOLVED,
        value: countFor(TICKET_STATUSES.RESOLVED),
        delta: this.percentageChange(resolvedCurrent, resolvedPrevious),
      },
      { key: 'CRITICAL', value: criticalOpen, delta: null },
    ];
  }

  /* ---------------------------------------------------------------------------
   * Serie de volumen
   * ------------------------------------------------------------------------ */

  /**
   * Tickets creados y resueltos por dia.
   *
   * Se resuelve con SQL directo porque Prisma no sabe agrupar por dia truncado;
   * hacerlo en memoria obligaria a traer todos los tickets del periodo.
   */
  private async buildVolume(): Promise<TicketVolumePoint[]> {
    const from = this.startOfDay(this.daysAgo(new Date(), VOLUME_DAYS - 1));

    const [createdRows, resolvedRows] = await Promise.all([
      this.prisma.$queryRaw<DailyCountRow[]>`
        SELECT date_trunc('day', created_at)::date AS date, COUNT(*) AS count
        FROM tickets
        WHERE created_at >= ${from}
        GROUP BY 1
      `,
      this.prisma.$queryRaw<DailyCountRow[]>`
        SELECT date_trunc('day', resolved_at)::date AS date, COUNT(*) AS count
        FROM tickets
        WHERE resolved_at IS NOT NULL AND resolved_at >= ${from}
        GROUP BY 1
      `,
    ]);

    const created = this.indexByDate(createdRows);
    const resolved = this.indexByDate(resolvedRows);

    // Se rellenan los dias sin actividad: un grafico con huecos se lee mal.
    return Array.from({ length: VOLUME_DAYS }, (_, index) => {
      const day = this.startOfDay(this.daysAgo(new Date(), VOLUME_DAYS - 1 - index));
      const key = this.toDateKey(day);

      return { date: key, created: created.get(key) ?? 0, resolved: resolved.get(key) ?? 0 };
    });
  }

  /* ---------------------------------------------------------------------------
   * Distribucion por tipo de servicio
   * ------------------------------------------------------------------------ */

  private async buildDistribution(): Promise<ServiceDistributionItem[]> {
    const grouped = await this.prisma.ticket.groupBy({
      by: ['projectId'],
      _count: { _all: true },
      where: { projectId: { not: null } },
    });

    const projectIds = grouped
      .map((row) => row.projectId)
      .filter((id): id is string => id !== null);

    if (projectIds.length === 0) {
      return [];
    }

    const projects = await this.prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, type: true },
    });

    const typeById = new Map(projects.map((project) => [project.id, project.type as ServiceType]));
    const totals = new Map<ServiceType, number>();

    for (const row of grouped) {
      const type = row.projectId ? typeById.get(row.projectId) : undefined;

      if (!type) continue;

      totals.set(type, (totals.get(type) ?? 0) + row._count._all);
    }

    const total = [...totals.values()].reduce((sum, value) => sum + value, 0);

    if (total === 0) return [];

    return [...totals.entries()]
      .map(([type, count]) => ({
        type,
        count,
        percentage: Math.round((count / total) * 1000) / 10,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /* ---------------------------------------------------------------------------
   * Actividad reciente y totales
   * ------------------------------------------------------------------------ */

  private async buildRecentTickets() {
    const tickets = await this.prisma.ticket.findMany({
      include: TICKET_RELATIONS,
      orderBy: { updatedAt: 'desc' },
      take: RECENT_LIMIT,
    });

    return tickets.map(toTicket);
  }

  private async buildTotals() {
    const [clients, projects, openTickets] = await Promise.all([
      this.prisma.client.count({ where: { status: 'ACTIVE' } }),
      this.prisma.project.count({ where: { status: 'ACTIVE' } }),
      this.prisma.ticket.count({ where: { status: { in: OPEN_TICKET_STATUSES } } }),
    ]);

    return { clients, projects, openTickets };
  }

  /* ---------------------------------------------------------------------------
   * Apoyo
   * ------------------------------------------------------------------------ */

  /** `null` cuando no hay periodo anterior: un "+100 %" desde cero enganaria. */
  private percentageChange(current: number, previous: number): number | null {
    if (previous === 0) return null;

    return Math.round(((current - previous) / previous) * 1000) / 10;
  }

  private daysAgo(from: Date, days: number): Date {
    const date = new Date(from);
    date.setDate(date.getDate() - days);

    return date;
  }

  private startOfDay(date: Date): Date {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);

    return copy;
  }

  private toDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
  }

  private indexByDate(rows: DailyCountRow[]): Map<string, number> {
    return new Map(rows.map((row) => [this.toDateKey(new Date(row.date)), Number(row.count)]));
  }
}
