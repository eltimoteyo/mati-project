import {
  type Message,
  MESSAGE_VISIBILITIES,
  NOTIFICATION_TYPES,
} from '@conit/types';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import { TicketMailService } from '../mail/ticket-mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TicketsService } from '../tickets/tickets.service';
import type { CreateMessageDto, UpdateMessageDto } from './dto/message.dto';
import { MESSAGE_RELATIONS, toMessage } from './messages.mapper';

/**
 * Conversacion de un ticket.
 *
 * Un mensaje publico de soporte cuenta como primera respuesta; una nota
 * interna no, porque el cliente no la ve. Esa distincion es la que hace que el
 * indicador de tiempo de respuesta signifique algo.
 */
@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketsService: TicketsService,
    private readonly notifications: NotificationsService,
    private readonly ticketMail: TicketMailService,
  ) {}

  async findAll(idOrCode: string): Promise<Message[]> {
    const ticketId = await this.ticketsService.resolveId(idOrCode);

    const messages = await this.prisma.message.findMany({
      where: { ticketId },
      include: MESSAGE_RELATIONS,
      orderBy: { createdAt: 'asc' },
    });

    return messages.map(toMessage);
  }

  async create(idOrCode: string, dto: CreateMessageDto, authorId: string): Promise<Message> {
    const ticketId = await this.ticketsService.resolveId(idOrCode);
    const visibility = dto.visibility ?? MESSAGE_VISIBILITIES.PUBLIC;

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: { ticketId, authorId, body: dto.body, visibility },
        include: MESSAGE_RELATIONS,
      });

      if (visibility === MESSAGE_VISIBILITIES.PUBLIC) {
        // `updateMany` con el filtro en el `where` hace la escritura
        // condicional en una sola consulta: solo marca la primera respuesta si
        // aun no habia ninguna, sin leer antes.
        await tx.ticket.updateMany({
          where: { id: ticketId, firstResponseAt: null },
          data: { firstResponseAt: new Date() },
        });
      }

      await this.notifyAssignee(tx, ticketId, authorId);

      return created;
    });

    // Solo salen por correo los mensajes publicos: una nota interna es
    // conversacion del equipo y el cliente no debe recibirla nunca.
    if (visibility === MESSAGE_VISIBILITIES.PUBLIC) {
      await this.ticketMail.sendTicketReply(ticketId, dto.body, message.author?.name ?? null);
    }

    return toMessage(message);
  }

  /**
   * Edita un mensaje.
   *
   * Solo su autor puede hacerlo: en un hilo compartido con el cliente, poder
   * reescribir lo que dijo otra persona destruiria la confianza en el registro.
   */
  async update(
    idOrCode: string,
    messageId: string,
    dto: UpdateMessageDto,
    actorId: string,
  ): Promise<Message> {
    const current = await this.loadOwned(idOrCode, messageId, actorId);

    const message = await this.prisma.message.update({
      where: { id: current.id },
      data: { body: dto.body, editedAt: new Date() },
      include: MESSAGE_RELATIONS,
    });

    return toMessage(message);
  }

  async remove(idOrCode: string, messageId: string, actorId: string): Promise<void> {
    const current = await this.loadOwned(idOrCode, messageId, actorId);

    await this.prisma.message.delete({ where: { id: current.id } });
  }

  /**
   * Avisa al responsable del ticket de que hay un mensaje nuevo.
   *
   * No se avisa al propio autor ni a un ticket sin responsable: en el primer
   * caso el aviso sobra, en el segundo no hay a quien dirigirlo.
   */
  private async notifyAssignee(
    tx: Prisma.TransactionClient,
    ticketId: string,
    authorId: string,
  ): Promise<void> {
    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, number: true, subject: true, assigneeId: true },
    });

    if (!ticket?.assigneeId || ticket.assigneeId === authorId) return;

    await this.notifications.notify(
      {
        userId: ticket.assigneeId,
        type: NOTIFICATION_TYPES.TICKET_MESSAGE,
        title: 'Nuevo mensaje en un ticket',
        body: NotificationsService.ticketLabel(ticket.number, ticket.subject),
        ticketId: ticket.id,
      },
      tx,
    );
  }

  /** Carga el mensaje comprobando que pertenece al ticket y al autor indicado. */
  private async loadOwned(idOrCode: string, messageId: string, actorId: string) {
    const ticketId = await this.ticketsService.resolveId(idOrCode);

    const message = await this.prisma.message.findFirst({
      where: { id: messageId, ticketId },
      select: { id: true, authorId: true },
    });

    if (!message) {
      throw new NotFoundException('El mensaje no existe en este ticket');
    }

    if (message.authorId !== actorId) {
      throw new ForbiddenException('Solo puedes modificar tus propios mensajes');
    }

    return message;
  }
}
