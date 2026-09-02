import {
  formatTicketCode,
  type Notification,
  NOTIFICATION_TYPES,
  type NotificationCount,
  type NotificationPreference,
  type NotificationType,
  type PaginatedData,
} from '@conit/types';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { paginate, type PaginationQueryDto, toSkipTake } from '../common/dto/pagination.dto';
import { PrismaService } from '../database/prisma.service';
import type { Prisma, PrismaClient } from '../generated/prisma/client';
import type { NotificationQueryDto } from './dto/notification-query.dto';
import { NOTIFICATION_RELATIONS, toNotification } from './notifications.mapper';

/** Cliente o transaccion: los emisores llaman desde dentro de la suya. */
type PrismaLike = PrismaService | Prisma.TransactionClient | PrismaClient;

/** Datos minimos para emitir un aviso. */
export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  ticketId?: string | null;
}

/**
 * Avisos dirigidos a una persona.
 *
 * La emision nunca hace fallar la accion que la origino: si un aviso no se
 * puede escribir, se registra y se sigue. Que no llegue una notificacion es
 * molesto; que no se pueda cerrar un ticket por eso, inaceptable.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    userId: string,
    query: NotificationQueryDto,
  ): Promise<PaginatedData<Notification>> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.unreadOnly ? { readAt: null } : {}),
      ...(query.type ? { type: query.type } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        include: NOTIFICATION_RELATIONS,
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(query as PaginationQueryDto),
      }),
      this.prisma.notification.count({ where }),
    ]);

    return paginate(items.map(toNotification), total, query as PaginationQueryDto);
  }

  async countUnread(userId: string): Promise<NotificationCount> {
    const unread = await this.prisma.notification.count({ where: { userId, readAt: null } });

    return { unread };
  }

  async markRead(userId: string, id: string): Promise<Notification> {
    // El `userId` va en el `where` para que nadie marque avisos ajenos.
    const existing = await this.prisma.notification.findFirst({
      where: { id, userId },
      select: { id: true, readAt: true },
    });

    if (!existing) {
      throw new NotFoundException('La notificacion no existe');
    }

    const notification = await this.prisma.notification.update({
      where: { id: existing.id },
      // Se conserva la marca original si ya estaba leida: relegarla al ultimo
      // clic falsearia cuando se vio por primera vez.
      data: { readAt: existing.readAt ?? new Date() },
      include: NOTIFICATION_RELATIONS,
    });

    return toNotification(notification);
  }

  async markAllRead(userId: string): Promise<NotificationCount> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });

    return { unread: 0 };
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.notification.deleteMany({ where: { id, userId } });

    if (count === 0) {
      throw new NotFoundException('La notificacion no existe');
    }
  }

  /* ---------------------------------------------------------------------------
   * Preferencias
   * ------------------------------------------------------------------------ */

  /** Devuelve siempre los cuatro tipos; sin fila guardada, el aviso esta activo. */
  async getPreferences(userId: string): Promise<NotificationPreference[]> {
    const stored = await this.prisma.notificationPreference.findMany({ where: { userId } });
    const byType = new Map(stored.map((row) => [row.type as NotificationType, row.enabled]));

    return Object.values(NOTIFICATION_TYPES).map((type) => ({
      type,
      enabled: byType.get(type) ?? true,
    }));
  }

  async setPreference(
    userId: string,
    type: NotificationType,
    enabled: boolean,
  ): Promise<NotificationPreference[]> {
    await this.prisma.notificationPreference.upsert({
      where: { userId_type: { userId, type } },
      create: { userId, type, enabled },
      update: { enabled },
    });

    return this.getPreferences(userId);
  }

  /* ---------------------------------------------------------------------------
   * Emision
   * ------------------------------------------------------------------------ */

  /**
   * Emite un aviso respetando las preferencias del destinatario.
   *
   * Acepta un cliente de transaccion para que el aviso viaje con el cambio que
   * lo provoca: si la transaccion se revierte, el aviso tampoco queda.
   */
  async notify(input: NotifyInput, client: PrismaLike = this.prisma): Promise<void> {
    try {
      const preference = await client.notificationPreference.findUnique({
        where: { userId_type: { userId: input.userId, type: input.type } },
        select: { enabled: true },
      });

      if (preference && !preference.enabled) return;

      await client.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          body: input.body,
          ticketId: input.ticketId ?? null,
        },
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo emitir la notificacion ${input.type} para ${input.userId}: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
    }
  }

  /** Texto estandar de la referencia al ticket, para no repetirlo en cada emisor. */
  static ticketLabel(number: number, subject: string): string {
    return `${formatTicketCode(number)} · ${subject}`;
  }
}
