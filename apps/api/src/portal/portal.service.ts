import {
  formatTicketCode,
  MESSAGE_SOURCES,
  MESSAGE_VISIBILITIES,
  NOTIFICATION_TYPES,
  OPEN_TICKET_STATUSES,
  type PaginatedData,
  type PortalProfile,
  type PortalTicket,
  type PortalTicketCounts,
  type PortalTicketDetail,
  type PortalTimelineEntry,
  type ServiceType,
  TICKET_EVENT_TYPES,
  TICKET_STATUS_LABELS,
  type TicketPriority,
  type TicketStatus,
} from '@conit/types';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { paginate, type PaginationQueryDto, toSkipTake } from '../common/dto/pagination.dto';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import { toMessage } from '../messages/messages.mapper';
import { NotificationsService } from '../notifications/notifications.service';
import { toProjectRef } from '../projects/projects.mapper';
import type { CreatePortalMessageDto, CreatePortalTicketDto } from './dto/portal.dto';
import type { PortalTicketQueryDto } from './dto/portal-query.dto';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Etiqueta visible -> clave de estado.
 *
 * La auditoria guarda los cambios ya traducidos ("En proceso"), porque su
 * proposito es leerse. El portal, en cambio, necesita la clave para pintar
 * cada hito con su color. Se invierte la misma tabla de etiquetas que se uso
 * al escribir, de modo que ambas caras no pueden discrepar.
 */
const STATUS_BY_LABEL = new Map<string, TicketStatus>(
  Object.entries(TICKET_STATUS_LABELS).map(([status, label]) => [label, status as TicketStatus]),
);

/**
 * Portal del cliente.
 *
 * Toda consulta arranca resolviendo la ficha de cliente a partir del usuario
 * de la sesion, y ese `clientId` entra en el `where` de cada operacion. No hay
 * ningun metodo que acepte un identificador de cliente desde fuera: es la
 * forma de garantizar por construccion que nadie lee lo de otro, en lugar de
 * confiar en acordarse de filtrar en cada consulta.
 *
 * Lo que el cliente NO ve, y por que:
 *
 *  - **Notas internas.** Se filtran por `visibility: PUBLIC` en la consulta,
 *    no despues de traerlas: asi no pueden escaparse por un descuido al
 *    serializar.
 *  - **La auditoria completa.** Solo se le devuelven los cambios de estado, que
 *    son los que responden a su pregunta ("como va lo mio"). El resto del
 *    historial es informacion de trabajo interno.
 *  - **A quien mas se atiende.** Ningun recuento ni listado sale del ambito de
 *    su propio cliente.
 */
@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /* ---------------------------------------------------------------------------
   * Perfil
   * ------------------------------------------------------------------------ */

  async getProfile(userId: string): Promise<PortalProfile> {
    const client = await this.resolveClient(userId);

    const [user, services, counts] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { id: true, name: true, email: true, avatar: true, lastLoginAt: true },
      }),
      this.prisma.project.findMany({
        where: { clientId: client.id, status: 'ACTIVE' },
        select: { id: true, name: true, type: true, url: true },
        orderBy: { name: 'asc' },
      }),
      this.countTickets(client.id),
    ]);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      },
      client: {
        id: client.id,
        name: client.name,
        taxId: client.taxId,
        contactName: client.contactName,
        email: client.email,
        phone: client.phone,
        address: client.address,
      },
      services: services
        .map((service) => toProjectRef(service))
        .filter((service): service is NonNullable<typeof service> => service !== null),
      counts,
    };
  }

  /* ---------------------------------------------------------------------------
   * Incidencias
   * ------------------------------------------------------------------------ */

  async findTickets(
    userId: string,
    query: PortalTicketQueryDto,
  ): Promise<PaginatedData<PortalTicket>> {
    const client = await this.resolveClient(userId);
    const term = query.search?.trim();

    const where: Prisma.TicketWhereInput = {
      clientId: client.id,
      ...(query.status ? { status: query.status } : {}),
      ...(query.openOnly ? { status: { in: OPEN_TICKET_STATUSES } } : {}),
      ...(term
        ? {
            OR: [
              { subject: { contains: term, mode: 'insensitive' } },
              { description: { contains: term, mode: 'insensitive' } },
              ...(Number.isSafeInteger(Number(term.replace(/\D/g, '')))
                ? [{ number: Number(term.replace(/\D/g, '')) }]
                : []),
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        select: this.ticketSelect(),
        orderBy: { updatedAt: 'desc' },
        ...toSkipTake(query as PaginationQueryDto),
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return paginate(
      items.map((ticket) => this.toPortalTicket(ticket)),
      total,
      query as PaginationQueryDto,
    );
  }

  async findTicket(userId: string, idOrCode: string): Promise<PortalTicketDetail> {
    const client = await this.resolveClient(userId);

    const ticket = await this.prisma.ticket.findFirst({
      // El `clientId` va en el mismo `where` que el identificador: un ticket de
      // otro cliente no es "prohibido", sencillamente no existe para este.
      where: { ...this.identityFilter(idOrCode), clientId: client.id },
      select: {
        ...this.ticketSelect(),
        description: true,
        messages: {
          // El filtro va en la consulta, no despues: las notas internas nunca
          // llegan a salir de la base de datos.
          where: { visibility: MESSAGE_VISIBILITIES.PUBLIC },
          include: { author: { select: { id: true, name: true, email: true, avatar: true } } },
          orderBy: { createdAt: 'asc' },
        },
        events: {
          where: { type: TICKET_EVENT_TYPES.STATUS_CHANGED },
          select: { toValue: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('La incidencia no existe');
    }

    // El alta abre siempre la linea temporal: es el primer hito real y no deja
    // rastro como cambio de estado.
    const timeline: PortalTimelineEntry[] = [
      { status: 'NEW', at: ticket.createdAt.toISOString() },
      ...ticket.events.flatMap((event) => {
        const status = event.toValue ? STATUS_BY_LABEL.get(event.toValue) : undefined;

        // Un registro antiguo cuya etiqueta ya no exista se omite: mejor una
        // linea temporal incompleta que un hito con un estado inventado.
        return status ? [{ status, at: event.createdAt.toISOString() }] : [];
      }),
    ];

    // El estado actual siempre cierra la linea temporal. Si no hay evento que
    // lo explique —una incidencia importada, por ejemplo— se anade sin fecha,
    // para que el seguimiento no contradiga al indicador de estado.
    const current = ticket.status as TicketStatus;

    if (timeline.at(-1)?.status !== current) {
      timeline.push({ status: current, at: null });
    }

    return {
      ...this.toPortalTicket(ticket),
      description: ticket.description,
      messages: ticket.messages.map(toMessage),
      timeline,
    };
  }

  async createTicket(userId: string, dto: CreatePortalTicketDto): Promise<PortalTicketDetail> {
    const client = await this.resolveClient(userId);

    // Un servicio de otro cliente no se puede asociar aunque se envie su id.
    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, clientId: client.id },
        select: { id: true },
      });

      if (!project) {
        throw new NotFoundException('El servicio indicado no existe');
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          subject: dto.subject,
          description: dto.description,
          clientId: client.id,
          projectId: dto.projectId ?? null,
          priority: (dto.priority ?? 'MEDIUM') as TicketPriority,
          // Lo registra el propio cliente: no hay actor de soporte detras.
          createdById: userId,
        },
        select: { id: true, number: true },
      });

      await tx.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          actorId: userId,
          type: TICKET_EVENT_TYPES.CREATED,
          note: 'Registrado por el cliente desde el portal',
        },
      });

      return ticket;
    });

    await this.notifySupport(created.id, created.number, dto.subject, 'Nueva incidencia de cliente');

    return this.findTicket(userId, created.id);
  }

  async addMessage(
    userId: string,
    idOrCode: string,
    dto: CreatePortalMessageDto,
  ): Promise<PortalTicketDetail> {
    const client = await this.resolveClient(userId);

    const ticket = await this.prisma.ticket.findFirst({
      where: { ...this.identityFilter(idOrCode), clientId: client.id },
      select: { id: true, number: true, subject: true, status: true, assigneeId: true },
    });

    if (!ticket) {
      throw new NotFoundException('La incidencia no existe');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.message.create({
        data: {
          ticketId: ticket.id,
          authorId: userId,
          body: dto.body,
          // Lo escribe el cliente: no tendria sentido ocultarselo.
          visibility: MESSAGE_VISIBILITIES.PUBLIC,
          source: MESSAGE_SOURCES.PORTAL,
        },
      });

      // Escribir sobre algo ya resuelto lo reabre: para quien lo sufre, el
      // problema no estaba cerrado.
      if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
        await tx.ticket.update({
          where: { id: ticket.id },
          data: { status: 'IN_REVIEW', resolvedAt: null, closedAt: null },
        });

        await tx.ticketEvent.create({
          data: {
            ticketId: ticket.id,
            actorId: userId,
            type: TICKET_EVENT_TYPES.STATUS_CHANGED,
            // Se guarda la etiqueta, no la clave: es el formato que usa el
            // resto de la auditoria y el que se lee en el historial.
            fromValue: TICKET_STATUS_LABELS[ticket.status as TicketStatus],
            toValue: TICKET_STATUS_LABELS.IN_REVIEW,
            note: 'Reabierto por un mensaje del cliente',
          },
        });
      }
    });

    await this.notifySupport(
      ticket.id,
      ticket.number,
      ticket.subject,
      'El cliente ha escrito en el portal',
    );

    return this.findTicket(userId, ticket.id);
  }

  /* ---------------------------------------------------------------------------
   * Apoyo
   * ------------------------------------------------------------------------ */

  /**
   * Ficha de cliente asociada al usuario.
   *
   * Un usuario con rol CLIENT pero sin ficha vinculada no puede operar: no se
   * sabe de quien son las incidencias que pediria. Se responde con un mensaje
   * que dice que hacer, en lugar de con una lista vacia que pareceria un fallo.
   */
  private async resolveClient(userId: string) {
    const client = await this.prisma.client.findUnique({
      where: { userId },
      select: {
        id: true,
        name: true,
        taxId: true,
        contactName: true,
        email: true,
        phone: true,
        address: true,
        status: true,
      },
    });

    if (!client) {
      throw new ForbiddenException(
        'Tu usuario todavia no esta vinculado a una ficha de cliente. Contacta con CONIT.',
      );
    }

    if (client.status !== 'ACTIVE') {
      throw new ForbiddenException('Tu cuenta de cliente esta inactiva. Contacta con CONIT.');
    }

    return client;
  }

  /** Un identificador mal formado debe dar 404, no reventar la consulta. */
  private identityFilter(idOrCode: string): Prisma.TicketWhereInput {
    if (UUID_PATTERN.test(idOrCode)) return { id: idOrCode };

    const digits = idOrCode.replace(/\D/g, '');
    const number = digits.length > 0 ? Number.parseInt(digits, 10) : Number.NaN;

    return Number.isSafeInteger(number) ? { number } : { id: '' };
  }

  private ticketSelect() {
    return {
      id: true,
      number: true,
      subject: true,
      status: true,
      priority: true,
      firstResponseAt: true,
      resolvedAt: true,
      createdAt: true,
      updatedAt: true,
      project: { select: { id: true, name: true, type: true, url: true } },
      assignee: { select: { name: true } },
      // Solo cuenta lo que el cliente puede ver: incluir las notas internas
      // revelaria que hay actividad que no se le muestra.
      _count: { select: { messages: { where: { visibility: MESSAGE_VISIBILITIES.PUBLIC } } } },
    } as const;
  }

  private toPortalTicket(ticket: {
    id: string;
    number: number;
    subject: string;
    status: string;
    priority: string;
    firstResponseAt: Date | null;
    resolvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    project: { id: string; name: string; type: ServiceType; url: string | null } | null;
    assignee: { name: string } | null;
    _count?: { messages: number };
  }): PortalTicket {
    return {
      id: ticket.id,
      code: formatTicketCode(ticket.number),
      subject: ticket.subject,
      status: ticket.status as TicketStatus,
      priority: ticket.priority as TicketPriority,
      service: toProjectRef(ticket.project),
      attendedBy: ticket.assignee?.name ?? null,
      firstResponseAt: ticket.firstResponseAt?.toISOString() ?? null,
      resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      messageCount: ticket._count?.messages ?? 0,
    };
  }

  private async countTickets(clientId: string): Promise<PortalTicketCounts> {
    const [open, resolved, total, awaitingResponse] = await Promise.all([
      this.prisma.ticket.count({ where: { clientId, status: { in: OPEN_TICKET_STATUSES } } }),
      this.prisma.ticket.count({ where: { clientId, status: 'RESOLVED' } }),
      this.prisma.ticket.count({ where: { clientId } }),
      this.prisma.ticket.count({
        where: { clientId, status: { in: OPEN_TICKET_STATUSES }, firstResponseAt: null },
      }),
    ]);

    return { open, resolved, total, awaitingResponse };
  }

  /** Avisa al responsable, o a todo el equipo si aun no hay ninguno. */
  private async notifySupport(
    ticketId: string,
    number: number,
    subject: string,
    title: string,
  ): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { assigneeId: true },
    });

    const body = NotificationsService.ticketLabel(number, subject);

    if (ticket?.assigneeId) {
      await this.notifications.notify({
        userId: ticket.assigneeId,
        type: NOTIFICATION_TYPES.TICKET_MESSAGE,
        title,
        body,
        ticketId,
      });

      return;
    }

    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE' },
      select: { id: true },
    });

    for (const admin of admins) {
      await this.notifications.notify({
        userId: admin.id,
        type: NOTIFICATION_TYPES.TICKET_MESSAGE,
        title,
        body,
        ticketId,
      });
    }
  }
}
