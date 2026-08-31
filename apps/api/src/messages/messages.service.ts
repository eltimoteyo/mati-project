import { type Message,MESSAGE_VISIBILITIES } from '@conit/types';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
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

      return created;
    });

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
