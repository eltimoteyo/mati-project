import type {
  AuditEntry,
  AuditSummary,
  PaginatedData,
  TicketEventType,
} from '@conit/types';
import { BadRequestException, Injectable } from '@nestjs/common';

import { paginate, type PaginationQueryDto, toSkipTake } from '../common/dto/pagination.dto';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import { AUDIT_RELATIONS, toAuditEntry } from './audit.mapper';
import type { AuditQueryDto } from './dto/audit-query.dto';

/**
 * Historial de auditoria.
 *
 * Es deliberadamente de solo lectura: un registro que se puede editar o borrar
 * desde la propia aplicacion no sirve como auditoria. Los eventos los escriben
 * los modulos que provocan el cambio, dentro de la misma transaccion.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AuditQueryDto): Promise<PaginatedData<AuditEntry>> {
    const where = this.buildWhere(query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.ticketEvent.findMany({
        where,
        include: AUDIT_RELATIONS,
        // El historial solo se ordena por fecha: cualquier otro criterio
        // rompe la lectura cronologica, que es su unica razon de ser.
        orderBy: { createdAt: query.sortOrder },
        ...toSkipTake(query as PaginationQueryDto),
      }),
      this.prisma.ticketEvent.count({ where }),
    ]);

    return paginate(items.map(toAuditEntry), total, query as PaginationQueryDto);
  }

  /**
   * Resumen del periodo consultado.
   *
   * Comparte el `where` con el listado a proposito: si la cabecera resumiera
   * el total historico mientras la tabla muestra una semana, el usuario leeria
   * dos cifras que no encajan.
   */
  async getSummary(query: AuditQueryDto): Promise<AuditSummary> {
    const where = this.buildWhere(query);

    const [total, byType, tickets, actors] = await Promise.all([
      this.prisma.ticketEvent.count({ where }),
      this.prisma.ticketEvent.groupBy({ by: ['type'], where, _count: { _all: true } }),
      // `distinct` sobre la clave agrupada es la forma de contar valores
      // unicos sin traerse las filas.
      this.prisma.ticketEvent.groupBy({ by: ['ticketId'], where }),
      this.prisma.ticketEvent.groupBy({
        by: ['actorId'],
        where: { ...where, actorId: { not: null } },
      }),
    ]);

    return {
      total,
      tickets: tickets.length,
      actors: actors.length,
      byType: byType
        .map((row) => ({ type: row.type as TicketEventType, count: row._count._all }))
        .sort((a, b) => b.count - a.count),
    };
  }

  /* ---------------------------------------------------------------------------
   * Filtros
   * ------------------------------------------------------------------------ */

  private buildWhere(query: AuditQueryDto): Prisma.TicketEventWhereInput {
    return {
      ...(query.type ? { type: query.type } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.ticketId ? { ticketId: query.ticketId } : {}),
      ...this.dateFilter(query.from, query.to),
      ...this.searchFilter(query.search),
    };
  }

  /**
   * Busqueda libre.
   *
   * Cubre el asunto del ticket, la nota y los valores del cambio. El numero
   * tambien se acepta para poder pegar un codigo `CNT-0042` tal cual: se
   * extraen sus digitos y se compara contra el correlativo.
   */
  private searchFilter(search: string | undefined): Prisma.TicketEventWhereInput {
    const term = search?.trim();

    if (!term) return {};

    const contains = { contains: term, mode: 'insensitive' } as const;
    const digits = term.replace(/\D/g, '');
    const number = digits.length > 0 ? Number.parseInt(digits, 10) : Number.NaN;

    return {
      OR: [
        { note: contains },
        { fromValue: contains },
        { toValue: contains },
        { ticket: { subject: contains } },
        ...(Number.isSafeInteger(number) ? [{ ticket: { number } }] : []),
      ],
    };
  }

  /**
   * Rango de fechas inclusivo por ambos extremos.
   *
   * `to` se desplaza al final del dia cuando llega sin hora: quien filtra
   * "hasta el 31" espera que el 31 entre, no que se corte a medianoche.
   */
  private dateFilter(from?: string, to?: string): Prisma.TicketEventWhereInput {
    if (!from && !to) return {};

    const gte = from ? new Date(from) : undefined;
    const lte = to ? this.endOfDayIfDateOnly(to) : undefined;

    if (gte && lte && gte > lte) {
      throw new BadRequestException('La fecha de inicio no puede ser posterior a la de fin');
    }

    return { createdAt: { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) } };
  }

  private endOfDayIfDateOnly(value: string): Date {
    const date = new Date(value);

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      date.setHours(23, 59, 59, 999);
    }

    return date;
  }
}
