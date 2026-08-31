import { OPEN_TICKET_STATUSES, type SupportAgent, type UserStatus } from '@conit/types';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

/** Ventana para medir la productividad reciente. */
const RESOLVED_WINDOW_DAYS = 30;

/**
 * Carga de trabajo del equipo de soporte.
 *
 * Es una vista de solo lectura sobre usuarios y tickets: no introduce entidades
 * nuevas. En esta fase el equipo son los administradores; cuando exista una
 * entidad propia de tecnicos, solo cambia la consulta de partida.
 */
@Injectable()
export class SupportTeamService {
  constructor(private readonly prisma: PrismaService) {}

  async findTeam(): Promise<SupportAgent[]> {
    const since = new Date();
    since.setDate(since.getDate() - RESOLVED_WINDOW_DAYS);

    const agents = await this.prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        status: true,
        lastLoginAt: true,
      },
      orderBy: { name: 'asc' },
    });

    if (agents.length === 0) return [];

    const ids = agents.map((agent) => agent.id);

    // Tres agregaciones sobre el conjunto completo, no una consulta por
    // persona: el coste no crece con el tamano del equipo.
    const [open, critical, resolved, total] = await Promise.all([
      this.prisma.ticket.groupBy({
        by: ['assigneeId'],
        where: { assigneeId: { in: ids }, status: { in: OPEN_TICKET_STATUSES } },
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['assigneeId'],
        where: {
          assigneeId: { in: ids },
          status: { in: OPEN_TICKET_STATUSES },
          priority: 'CRITICAL',
        },
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['assigneeId'],
        where: { assigneeId: { in: ids }, resolvedAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['assigneeId'],
        where: { assigneeId: { in: ids } },
        _count: { _all: true },
      }),
    ]);

    const index = (rows: Array<{ assigneeId: string | null; _count: { _all: number } }>) =>
      new Map(rows.filter((row) => row.assigneeId).map((row) => [row.assigneeId!, row._count._all]));

    const openBy = index(open);
    const criticalBy = index(critical);
    const resolvedBy = index(resolved);
    const totalBy = index(total);

    return agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      email: agent.email,
      avatar: agent.avatar,
      status: agent.status as UserStatus,
      lastLoginAt: agent.lastLoginAt?.toISOString() ?? null,
      workload: {
        open: openBy.get(agent.id) ?? 0,
        critical: criticalBy.get(agent.id) ?? 0,
        resolvedLast30Days: resolvedBy.get(agent.id) ?? 0,
        total: totalBy.get(agent.id) ?? 0,
      },
    }));
  }

  /** Tickets abiertos sin responsable: el hueco que el equipo debe cubrir. */
  async countUnassigned(): Promise<number> {
    return this.prisma.ticket.count({
      where: { assigneeId: null, status: { in: OPEN_TICKET_STATUSES } },
    });
  }
}
