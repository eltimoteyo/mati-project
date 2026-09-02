import {
  OPEN_TICKET_STATUSES,
  type ReportAgentPerformance,
  type ReportCount,
  type ReportNamedCount,
  type ReportPeriod,
  type ReportSummary,
  type ReportTimes,
  type ReportTotals,
  type ReportVolumePoint,
  TICKET_EVENT_TYPES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketPriority,
  type TicketStatus,
} from '@conit/types';
import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import type { ReportQueryDto } from './dto/report-query.dto';

/** Periodo por defecto cuando no se indican fechas. */
const DEFAULT_DAYS = 30;

/** Maximo de dias analizables de una vez, para acotar el coste de la consulta. */
const MAX_DAYS = 366;

/** Filas mostradas en los desgloses por cliente y categoria. */
const BREAKDOWN_LIMIT = 8;

interface DailyRow {
  date: Date;
  count: bigint | number;
}

interface TimesRow {
  response_avg: number | null;
  resolution_avg: number | null;
}

interface SlaRow {
  measured: bigint | number;
  response_ok: bigint | number;
  response_measured: bigint | number;
  resolution_ok: bigint | number;
  resolution_measured: bigint | number;
}

interface AgentRow {
  id: string;
  name: string;
  assigned: bigint | number;
  resolved: bigint | number;
  resolution_avg: number | null;
}

/**
 * Reportes operativos.
 *
 * Todo se calcula contra los datos reales: no hay ninguna cifra estimada ni
 * proyectada. Cuando una metrica no se puede medir (por ejemplo, el tiempo
 * medio de respuesta si nadie ha respondido aun) se devuelve `null` y la
 * interfaz lo muestra como "sin datos" en lugar de como un cero.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(query: ReportQueryDto): Promise<ReportSummary> {
    const period = this.resolvePeriod(query);
    const scope = this.scopeFilter(query);

    const [totals, times, volume, byStatus, byPriority, byClient, byCategory, byAgent] =
      await Promise.all([
        this.buildTotals(period, query),
        this.buildTimes(period, scope),
        this.buildVolume(period, scope),
        this.buildByStatus(period, query),
        this.buildByPriority(period, query),
        this.buildByClient(period, query),
        this.buildByCategory(period, query),
        this.buildByAgent(period, scope),
      ]);

    return { period, totals, times, volume, byStatus, byPriority, byClient, byCategory, byAgent };
  }

  /**
   * Exportacion a CSV de los tickets del periodo.
   *
   * Se genera aqui y no en el cliente porque el navegador solo tiene la pagina
   * que esta viendo: exportar desde alli daria un fichero incompleto sin que
   * nadie lo notase.
   */
  async exportCsv(query: ReportQueryDto): Promise<string> {
    const period = this.resolvePeriod(query);

    const tickets = await this.prisma.ticket.findMany({
      where: {
        createdAt: { gte: new Date(period.from), lte: new Date(period.to) },
        ...(query.clientId ? { clientId: query.clientId } : {}),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      },
      select: {
        number: true,
        subject: true,
        status: true,
        priority: true,
        createdAt: true,
        firstResponseAt: true,
        resolvedAt: true,
        client: { select: { name: true } },
        category: { select: { name: true } },
        project: { select: { name: true } },
        assignee: { select: { name: true } },
      },
      orderBy: { number: 'asc' },
    });

    const headers = [
      'Codigo',
      'Asunto',
      'Cliente',
      'Servicio',
      'Categoria',
      'Prioridad',
      'Estado',
      'Responsable',
      'Creado',
      'Primera respuesta',
      'Resuelto',
      'Minutos hasta respuesta',
      'Minutos hasta resolucion',
    ];

    const rows = tickets.map((ticket) => [
      `CNT-${String(ticket.number).padStart(4, '0')}`,
      ticket.subject,
      ticket.client.name,
      ticket.project?.name ?? '',
      ticket.category?.name ?? '',
      ticket.priority,
      ticket.status,
      ticket.assignee?.name ?? '',
      ticket.createdAt.toISOString(),
      ticket.firstResponseAt?.toISOString() ?? '',
      ticket.resolvedAt?.toISOString() ?? '',
      this.minutesBetween(ticket.createdAt, ticket.firstResponseAt),
      this.minutesBetween(ticket.createdAt, ticket.resolvedAt),
    ]);

    return [headers, ...rows].map((row) => row.map(this.toCsvCell).join(',')).join('\r\n');
  }

  /* ---------------------------------------------------------------------------
   * Totales
   * ------------------------------------------------------------------------ */

  private async buildTotals(period: ReportPeriod, query: ReportQueryDto): Promise<ReportTotals> {
    const from = new Date(period.from);
    const to = new Date(period.to);
    const base = this.prismaScope(query);

    const [created, resolved, open, reopened] = await Promise.all([
      this.prisma.ticket.count({ where: { ...base, createdAt: { gte: from, lte: to } } }),
      this.prisma.ticket.count({ where: { ...base, resolvedAt: { gte: from, lte: to } } }),
      this.prisma.ticket.count({ where: { ...base, status: { in: OPEN_TICKET_STATUSES } } }),
      // Una reapertura es un cambio de estado que sale de RESUELTO: se lee del
      // historial, que es donde queda constancia de lo que paso.
      this.prisma.ticketEvent.count({
        where: {
          type: TICKET_EVENT_TYPES.STATUS_CHANGED,
          fromValue: TICKET_STATUSES.RESOLVED,
          toValue: { in: OPEN_TICKET_STATUSES },
          createdAt: { gte: from, lte: to },
          ...(query.clientId || query.categoryId ? { ticket: base } : {}),
        },
      }),
    ]);

    return { created, resolved, open, reopened };
  }

  /* ---------------------------------------------------------------------------
   * Tiempos y cumplimiento de objetivos
   * ------------------------------------------------------------------------ */

  private async buildTimes(period: ReportPeriod, scope: Prisma.Sql): Promise<ReportTimes> {
    const from = new Date(period.from);
    const to = new Date(period.to);

    const [timeRows, slaRows] = await Promise.all([
      // `EXTRACT(EPOCH FROM ...)` da segundos; se pasa a minutos al leerlo.
      this.prisma.$queryRaw<TimesRow[]>`
        SELECT
          AVG(EXTRACT(EPOCH FROM (t.first_response_at - t.created_at)))
            FILTER (WHERE t.first_response_at IS NOT NULL) AS response_avg,
          AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)))
            FILTER (WHERE t.resolved_at IS NOT NULL) AS resolution_avg
        FROM tickets t
        WHERE t.created_at >= ${from} AND t.created_at <= ${to} ${scope}
      `,
      // El objetivo vive en la categoria: un ticket sin categoria, o con una
      // que no fija objetivos, no se puede medir y queda fuera del porcentaje.
      this.prisma.$queryRaw<SlaRow[]>`
        SELECT
          COUNT(*) AS measured,
          COUNT(*) FILTER (
            WHERE c.response_time_minutes IS NOT NULL AND t.first_response_at IS NOT NULL
          ) AS response_measured,
          COUNT(*) FILTER (
            WHERE c.response_time_minutes IS NOT NULL AND t.first_response_at IS NOT NULL
              AND EXTRACT(EPOCH FROM (t.first_response_at - t.created_at)) / 60
                  <= c.response_time_minutes
          ) AS response_ok,
          COUNT(*) FILTER (
            WHERE c.resolution_time_minutes IS NOT NULL AND t.resolved_at IS NOT NULL
          ) AS resolution_measured,
          COUNT(*) FILTER (
            WHERE c.resolution_time_minutes IS NOT NULL AND t.resolved_at IS NOT NULL
              AND EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 60
                  <= c.resolution_time_minutes
          ) AS resolution_ok
        FROM tickets t
        INNER JOIN categories c ON c.id = t.category_id
        WHERE t.created_at >= ${from} AND t.created_at <= ${to} ${scope}
      `,
    ]);

    const times = timeRows[0];
    const sla = slaRows[0];

    return {
      firstResponseMinutes: this.secondsToMinutes(times?.response_avg ?? null),
      resolutionMinutes: this.secondsToMinutes(times?.resolution_avg ?? null),
      responseWithinTargetPct: this.ratio(sla?.response_ok, sla?.response_measured),
      resolutionWithinTargetPct: this.ratio(sla?.resolution_ok, sla?.resolution_measured),
      measuredAgainstTarget: Number(sla?.measured ?? 0),
    };
  }

  /* ---------------------------------------------------------------------------
   * Serie temporal
   * ------------------------------------------------------------------------ */

  private async buildVolume(period: ReportPeriod, scope: Prisma.Sql): Promise<ReportVolumePoint[]> {
    const from = this.startOfDay(new Date(period.from));
    const to = new Date(period.to);

    const [createdRows, resolvedRows] = await Promise.all([
      this.prisma.$queryRaw<DailyRow[]>`
        SELECT date_trunc('day', t.created_at)::date AS date, COUNT(*) AS count
        FROM tickets t
        WHERE t.created_at >= ${from} AND t.created_at <= ${to} ${scope}
        GROUP BY 1
      `,
      this.prisma.$queryRaw<DailyRow[]>`
        SELECT date_trunc('day', t.resolved_at)::date AS date, COUNT(*) AS count
        FROM tickets t
        WHERE t.resolved_at IS NOT NULL
          AND t.resolved_at >= ${from} AND t.resolved_at <= ${to} ${scope}
        GROUP BY 1
      `,
    ]);

    const created = this.indexByDate(createdRows);
    const resolved = this.indexByDate(resolvedRows);

    // Se rellenan los dias vacios: un grafico con huecos sugiere datos perdidos.
    return Array.from({ length: period.days }, (_, index) => {
      const day = new Date(from);
      day.setDate(day.getDate() + index);

      const key = this.toDateKey(day);

      return { date: key, created: created.get(key) ?? 0, resolved: resolved.get(key) ?? 0 };
    });
  }

  /* ---------------------------------------------------------------------------
   * Desgloses
   * ------------------------------------------------------------------------ */

  private async buildByStatus(
    period: ReportPeriod,
    query: ReportQueryDto,
  ): Promise<ReportCount<TicketStatus>[]> {
    const grouped = await this.prisma.ticket.groupBy({
      by: ['status'],
      where: this.periodWhere(period, query),
      _count: { _all: true },
    });

    const total = grouped.reduce((sum, row) => sum + row._count._all, 0);

    return Object.values(TICKET_STATUSES).map((status) => {
      const count = grouped.find((row) => row.status === status)?._count._all ?? 0;

      return { key: status, count, percentage: this.percentage(count, total) };
    });
  }

  private async buildByPriority(
    period: ReportPeriod,
    query: ReportQueryDto,
  ): Promise<ReportCount<TicketPriority>[]> {
    const grouped = await this.prisma.ticket.groupBy({
      by: ['priority'],
      where: this.periodWhere(period, query),
      _count: { _all: true },
    });

    const total = grouped.reduce((sum, row) => sum + row._count._all, 0);

    return Object.values(TICKET_PRIORITIES).map((priority) => {
      const count = grouped.find((row) => row.priority === priority)?._count._all ?? 0;

      return { key: priority, count, percentage: this.percentage(count, total) };
    });
  }

  private async buildByClient(
    period: ReportPeriod,
    query: ReportQueryDto,
  ): Promise<ReportNamedCount[]> {
    const grouped = await this.prisma.ticket.groupBy({
      by: ['clientId'],
      where: this.periodWhere(period, query),
      _count: { _all: true },
      orderBy: { _count: { id: 'desc' } },
      take: BREAKDOWN_LIMIT,
    });

    if (grouped.length === 0) return [];

    const total = await this.prisma.ticket.count({ where: this.periodWhere(period, query) });

    const clients = await this.prisma.client.findMany({
      where: { id: { in: grouped.map((row) => row.clientId) } },
      select: { id: true, name: true },
    });

    const nameById = new Map(clients.map((client) => [client.id, client.name]));

    return grouped.map((row) => ({
      id: row.clientId,
      name: nameById.get(row.clientId) ?? 'Cliente eliminado',
      count: row._count._all,
      percentage: this.percentage(row._count._all, total),
    }));
  }

  private async buildByCategory(
    period: ReportPeriod,
    query: ReportQueryDto,
  ): Promise<ReportNamedCount[]> {
    const grouped = await this.prisma.ticket.groupBy({
      by: ['categoryId'],
      where: this.periodWhere(period, query),
      _count: { _all: true },
      orderBy: { _count: { id: 'desc' } },
      take: BREAKDOWN_LIMIT,
    });

    if (grouped.length === 0) return [];

    const total = await this.prisma.ticket.count({ where: this.periodWhere(period, query) });

    const ids = grouped.map((row) => row.categoryId).filter((id): id is string => id !== null);

    const categories =
      ids.length > 0
        ? await this.prisma.category.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true },
          })
        : [];

    const nameById = new Map(categories.map((category) => [category.id, category.name]));

    return grouped.map((row) => ({
      // Los tickets sin clasificar se agrupan bajo una clave estable para que
      // la interfaz pueda mostrarlos sin inventarse un identificador.
      id: row.categoryId ?? 'uncategorized',
      name: row.categoryId ? (nameById.get(row.categoryId) ?? 'Categoria eliminada') : 'Sin clasificar',
      count: row._count._all,
      percentage: this.percentage(row._count._all, total),
    }));
  }

  /**
   * Rendimiento por responsable.
   *
   * Se resuelve en una sola consulta agregada: pedir los tickets de cada agente
   * por separado seria una consulta por persona.
   */
  private async buildByAgent(
    period: ReportPeriod,
    scope: Prisma.Sql,
  ): Promise<ReportAgentPerformance[]> {
    const from = new Date(period.from);
    const to = new Date(period.to);

    const rows = await this.prisma.$queryRaw<AgentRow[]>`
      SELECT
        u.id,
        u.name,
        COUNT(*) FILTER (WHERE t.created_at >= ${from} AND t.created_at <= ${to}) AS assigned,
        COUNT(*) FILTER (WHERE t.resolved_at >= ${from} AND t.resolved_at <= ${to}) AS resolved,
        AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)))
          FILTER (WHERE t.resolved_at >= ${from} AND t.resolved_at <= ${to}) AS resolution_avg
      FROM users u
      INNER JOIN tickets t ON t.assignee_id = u.id
      WHERE (
        (t.created_at >= ${from} AND t.created_at <= ${to})
        OR (t.resolved_at >= ${from} AND t.resolved_at <= ${to})
      ) ${scope}
      GROUP BY u.id, u.name
      ORDER BY resolved DESC, assigned DESC
    `;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      assigned: Number(row.assigned),
      resolved: Number(row.resolved),
      averageResolutionMinutes: this.secondsToMinutes(row.resolution_avg),
    }));
  }

  /* ---------------------------------------------------------------------------
   * Apoyo
   * ------------------------------------------------------------------------ */

  /**
   * Resuelve el periodo analizado.
   *
   * `to` se lleva al final del dia cuando llega sin hora, para que el ultimo
   * dia entre completo en el reporte.
   */
  private resolvePeriod(query: ReportQueryDto): ReportPeriod {
    const to = query.to ? this.endOfDayIfDateOnly(query.to) : new Date();
    const from = query.from
      ? this.startOfDay(new Date(query.from))
      : this.startOfDay(this.daysAgo(to, DEFAULT_DAYS - 1));

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Las fechas indicadas no son validas');
    }

    if (from > to) {
      throw new BadRequestException('La fecha de inicio no puede ser posterior a la de fin');
    }

    const days = Math.floor((this.startOfDay(to).getTime() - from.getTime()) / 86_400_000) + 1;

    if (days > MAX_DAYS) {
      throw new BadRequestException(`El periodo no puede superar los ${MAX_DAYS} dias`);
    }

    return { from: from.toISOString(), to: to.toISOString(), days };
  }

  /** Filtros opcionales como fragmento SQL, listo para concatenar en un `WHERE`. */
  private scopeFilter(query: ReportQueryDto): Prisma.Sql {
    const parts: Prisma.Sql[] = [];

    if (query.clientId) {
      parts.push(Prisma.sql`AND t.client_id = ${query.clientId}::uuid`);
    }

    if (query.categoryId) {
      parts.push(Prisma.sql`AND t.category_id = ${query.categoryId}::uuid`);
    }

    return parts.length > 0 ? Prisma.join(parts, ' ') : Prisma.empty;
  }

  /** Los mismos filtros para las consultas que sí puede expresar Prisma. */
  private prismaScope(query: ReportQueryDto): Prisma.TicketWhereInput {
    return {
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    };
  }

  private periodWhere(period: ReportPeriod, query: ReportQueryDto): Prisma.TicketWhereInput {
    return {
      ...this.prismaScope(query),
      createdAt: { gte: new Date(period.from), lte: new Date(period.to) },
    };
  }

  private secondsToMinutes(value: number | string | null): number | null {
    if (value === null) return null;

    const seconds = Number(value);

    return Number.isFinite(seconds) ? Math.round(seconds / 60) : null;
  }

  /** `null` cuando no hay nada que medir: un 0 % se leeria como incumplimiento. */
  private ratio(ok: bigint | number | undefined, total: bigint | number | undefined): number | null {
    const denominator = Number(total ?? 0);

    if (denominator === 0) return null;

    return Math.round((Number(ok ?? 0) / denominator) * 1000) / 10;
  }

  private percentage(count: number, total: number): number {
    if (total === 0) return 0;

    return Math.round((count / total) * 1000) / 10;
  }

  private minutesBetween(start: Date, end: Date | null): string {
    if (!end) return '';

    return String(Math.round((end.getTime() - start.getTime()) / 60_000));
  }

  /** Escapa la celda segun RFC 4180 para que una coma no parta la fila. */
  private toCsvCell(value: string): string {
    if (/[",\r\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }

    return value;
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

  private endOfDayIfDateOnly(value: string): Date {
    const date = new Date(value);

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      date.setHours(23, 59, 59, 999);
    }

    return date;
  }

  private toDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
  }

  private indexByDate(rows: DailyRow[]): Map<string, number> {
    return new Map(rows.map((row) => [this.toDateKey(new Date(row.date)), Number(row.count)]));
  }
}
