import {
  canTransition,
  formatTicketCode,
  MESSAGE_SOURCES,
  MESSAGE_VISIBILITIES,
  NOTIFICATION_TYPES,
  OPEN_TICKET_STATUSES,
  type PaginatedData,
  type Ticket as TicketContract,
  TICKET_EVENT_TYPES,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_TRANSITIONS,
  type TicketDetail,
  type TicketStatus,
} from '@conit/types';
import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { AiService } from '../ai/ai.service';
import {
  paginate,
  type PaginationQueryDto,
  searchFilter,
  toSkipTake,
} from '../common/dto/pagination.dto';
import { slugify } from '../common/utils/slug.util';
import { PrismaService } from '../database/prisma.service';
import { Prisma, type Ticket } from '../generated/prisma/client';
import { TicketMailService } from '../mail/ticket-mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TicketWhatsappService } from '../whatsapp/ticket-whatsapp.service';
import type { CreateTicketDto } from './dto/create-ticket.dto';
import type { TicketQueryDto } from './dto/ticket-query.dto';
import type { UpdateTicketDto } from './dto/update-ticket.dto';
import { TICKET_RELATIONS, toTicket, toTicketDetail } from './tickets.mapper';

/** Entrada de historial pendiente de escribir. */
interface PendingEvent {
  type: (typeof TICKET_EVENT_TYPES)[keyof typeof TICKET_EVENT_TYPES];
  fromValue?: string | null;
  toValue?: string | null;
  note?: string | null;
}

/** Reconoce un codigo visible de ticket (`CNT-0042`) y extrae su correlativo. */
const TICKET_CODE_PATTERN = /^CNT-(\d+)$/i;

/** Forma de un UUID; se comprueba antes de consultar una columna `uuid`. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly ticketMail: TicketMailService,
    private readonly ticketWhatsapp: TicketWhatsappService,
    @Inject(forwardRef(() => AiService)) private readonly aiService: AiService,
  ) {}

  /* ---------------------------------------------------------------------------
   * Lectura
   * ------------------------------------------------------------------------ */

  async findAll(query: TicketQueryDto): Promise<PaginatedData<TicketContract>> {
    const where: Prisma.TicketWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.openOnly && !query.status ? { status: { in: OPEN_TICKET_STATUSES } } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
      ...this.buildSearch(query.search),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        include: TICKET_RELATIONS,
        orderBy: { [query.sortBy]: query.sortOrder },
        ...toSkipTake(query as PaginationQueryDto),
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return paginate(items.map(toTicket), total, query as PaginationQueryDto);
  }

  /** Acepta tanto el UUID como el codigo visible (`CNT-0042`). */
  async findOne(idOrCode: string): Promise<TicketDetail> {
    const ticket = await this.prisma.ticket.findFirst({
      where: this.identityFilter(idOrCode),
      include: {
        ...TICKET_RELATIONS,
        events: {
          include: { actor: { select: { id: true, name: true, email: true, avatar: true } } },
          orderBy: { createdAt: 'desc' },
        },
        // La conversacion va en orden ascendente: un hilo se lee de arriba
        // abajo, al reves que el historial de cambios.
        messages: {
          include: { author: { select: { id: true, name: true, email: true, avatar: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('El ticket no existe');
    }

    return toTicketDetail(ticket);
  }

  /* ---------------------------------------------------------------------------
   * Escritura
   * ------------------------------------------------------------------------ */

  /**
   * @param origin De donde viene el alta cuando no es el formulario de
   *   tickets: la conversacion de WhatsApp que lo origino y la nota que lo
   *   explica en el historial.
   */
  async create(
    dto: CreateTicketDto,
    /** Quien lo registra; `null` cuando lo crea el asistente de IA. */
    actorId: string | null,
    origin: { whatsappConversationId?: string; note?: string } = {},
  ): Promise<TicketDetail> {
    await this.assertRelations(dto.clientId, dto.projectId, dto.categoryId, dto.assigneeId);

    const created = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          subject: dto.subject,
          description: dto.description,
          clientId: dto.clientId,
          projectId: dto.projectId ?? null,
          categoryId: dto.categoryId ?? null,
          assigneeId: dto.assigneeId ?? null,
          createdById: actorId,
          whatsappConversationId: origin.whatsappConversationId ?? null,
          ...(dto.priority ? { priority: dto.priority } : {}),
        },
      });

      const events: PendingEvent[] = [
        { type: TICKET_EVENT_TYPES.CREATED, note: origin.note ?? null },
      ];

      if (dto.assigneeId) {
        const assignee = await tx.user.findUnique({
          where: { id: dto.assigneeId },
          select: { name: true },
        });

        events.push({ type: TICKET_EVENT_TYPES.ASSIGNED, toValue: assignee?.name ?? null });
      }

      await this.writeEvents(tx, ticket.id, actorId, events);
      await this.notifyOnCreate(tx, ticket, actorId);

      return ticket;
    });

    this.logger.log(
      `Ticket ${formatTicketCode(created.number)} creado por ${actorId ?? 'el asistente de IA'}`,
    );

    // El correo se envia despues de confirmar la transaccion: avisar de un
    // ticket que luego se revierte seria peor que no avisar. `MailService`
    // nunca lanza, asi que esperar aqui no puede tumbar el alta.
    await this.ticketMail.sendTicketCreated(created.id);

    return this.findOne(created.id);
  }

  async update(idOrCode: string, dto: UpdateTicketDto, actorId: string): Promise<TicketDetail> {
    const current = await this.loadRaw(idOrCode);

    if (dto.status && dto.status !== current.status) {
      this.assertTransition(current.status as TicketStatus, dto.status);
    }

    await this.assertRelations(current.clientId, dto.projectId, dto.categoryId, dto.assigneeId);

    const events: PendingEvent[] = [];
    const data: Prisma.TicketUpdateInput = {};

    // --- Campos de texto -----------------------------------------------------
    let contentChanged = false;

    if (dto.subject !== undefined && dto.subject !== current.subject) {
      data.subject = dto.subject;
      contentChanged = true;
    }

    if (dto.description !== undefined && dto.description !== current.description) {
      data.description = dto.description;
      contentChanged = true;
    }

    if (contentChanged) {
      events.push({ type: TICKET_EVENT_TYPES.UPDATED });
    }

    // --- Prioridad -----------------------------------------------------------
    if (dto.priority && dto.priority !== current.priority) {
      data.priority = dto.priority;
      events.push({
        type: TICKET_EVENT_TYPES.PRIORITY_CHANGED,
        fromValue: TICKET_PRIORITY_LABELS[current.priority],
        toValue: TICKET_PRIORITY_LABELS[dto.priority],
      });
    }

    // --- Categoria -----------------------------------------------------------
    if (dto.categoryId !== undefined && dto.categoryId !== current.categoryId) {
      data.category = dto.categoryId ? { connect: { id: dto.categoryId } } : { disconnect: true };
      events.push({
        type: TICKET_EVENT_TYPES.CATEGORY_CHANGED,
        fromValue: await this.categoryName(current.categoryId),
        toValue: await this.categoryName(dto.categoryId),
      });
    }

    // --- Servicio ------------------------------------------------------------
    if (dto.projectId !== undefined && dto.projectId !== current.projectId) {
      data.project = dto.projectId ? { connect: { id: dto.projectId } } : { disconnect: true };
      events.push({ type: TICKET_EVENT_TYPES.UPDATED });
    }

    // --- Responsable ---------------------------------------------------------
    if (dto.assigneeId !== undefined && dto.assigneeId !== current.assigneeId) {
      data.assignee = dto.assigneeId ? { connect: { id: dto.assigneeId } } : { disconnect: true };
      events.push(
        dto.assigneeId
          ? {
              type: TICKET_EVENT_TYPES.ASSIGNED,
              fromValue: await this.userName(current.assigneeId),
              toValue: await this.userName(dto.assigneeId),
            }
          : {
              type: TICKET_EVENT_TYPES.UNASSIGNED,
              fromValue: await this.userName(current.assigneeId),
            },
      );
    }

    // --- Estado --------------------------------------------------------------
    if (dto.status && dto.status !== current.status) {
      Object.assign(data, this.statusSideEffects(current, dto.status));
      events.push({
        type: TICKET_EVENT_TYPES.STATUS_CHANGED,
        fromValue: TICKET_STATUS_LABELS[current.status as TicketStatus],
        toValue: TICKET_STATUS_LABELS[dto.status],
      });
    }

    if (events.length === 0) {
      // Nada cambio: se evita escribir una version identica y un evento vacio.
      return this.findOne(current.id);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.ticket.update({ where: { id: current.id }, data });
      await this.writeEvents(tx, current.id, actorId, events);
      await this.notifyOnUpdate(tx, current, dto, actorId);
    });

    // El aviso por WhatsApp sale al llegar a un estado final. Cerrar un ticket
    // que ya estaba resuelto no avisa de nuevo: el cliente ya lo supo al
    // resolverse y un segundo mensaje no le diria nada.
    if (
      dto.status &&
      dto.status !== current.status &&
      (dto.status === 'RESOLVED' || (dto.status === 'CLOSED' && current.status !== 'RESOLVED'))
    ) {
      await this.ticketWhatsapp.sendTicketStatus(current.id);
    }

    // Por correo solo se comunica la resolucion. Los estados intermedios son
    // informacion de proceso: enviarlos convertiria su buzon en un registro de
    // auditoria y acabaria en la carpeta de correo no deseado.
    if (dto.status === 'RESOLVED' && current.status !== 'RESOLVED') {
      await this.closeWithAssistant(current, actorId);
      await this.ticketMail.sendTicketResolved(current.id);
    }

    return this.findOne(current.id);
  }

  /**
   * Elimina un ticket.
   *
   * Solo se permite si sigue en estado NEW: a partir de ahi el ticket forma
   * parte del historial de atencion del cliente. Los tickets ya trabajados se
   * cierran, no se borran.
   */
  async remove(idOrCode: string): Promise<void> {
    const ticket = await this.loadRaw(idOrCode);

    if (ticket.status !== 'NEW') {
      throw new ConflictException(
        'Solo se pueden eliminar tickets que siguen en estado "Nuevo". ' +
          'Para el resto, usa el estado "Cerrado".',
      );
    }

    await this.prisma.ticket.delete({ where: { id: ticket.id } });
  }

  /* ---------------------------------------------------------------------------
   * Apoyo
   * ------------------------------------------------------------------------ */

  /**
   * Filtro que resuelve tanto un UUID como un codigo `CNT-0042`.
   *
   * Si el valor no es ninguno de los dos se responde 404 en lugar de dejar que
   * PostgreSQL rechace el literal en una columna `uuid`, que se traduciria en
   * un 500 poco util para quien consume la API.
   */
  private identityFilter(idOrCode: string): Prisma.TicketWhereInput {
    const value = idOrCode.trim();
    const match = TICKET_CODE_PATTERN.exec(value);

    if (match?.[1]) {
      return { number: Number(match[1]) };
    }

    if (!UUID_PATTERN.test(value)) {
      throw new NotFoundException('El ticket no existe');
    }

    return { id: value };
  }

  /**
   * Resuelve el UUID de un ticket a partir de su UUID o de su codigo visible.
   * La expone el modulo de conversaciones, que anida sus rutas bajo el ticket.
   */
  async resolveId(idOrCode: string): Promise<string> {
    const ticket = await this.prisma.ticket.findFirst({
      where: this.identityFilter(idOrCode),
      select: { id: true },
    });

    if (!ticket) {
      throw new NotFoundException('El ticket no existe');
    }

    return ticket.id;
  }

  private async loadRaw(idOrCode: string): Promise<Ticket> {
    const ticket = await this.prisma.ticket.findFirst({ where: this.identityFilter(idOrCode) });

    if (!ticket) {
      throw new NotFoundException('El ticket no existe');
    }

    return ticket;
  }

  /**
   * Busqueda por asunto, descripcion o codigo.
   * Si el termino es un numero o un codigo, se busca tambien por correlativo.
   */
  private buildSearch(search: string | undefined): Prisma.TicketWhereInput {
    const term = search?.trim();

    if (!term) return {};

    const textFilter = searchFilter(term, ['subject', 'description']);
    const conditions: Prisma.TicketWhereInput[] = textFilter ? [...textFilter.OR] : [];

    const codeMatch = TICKET_CODE_PATTERN.exec(term);
    const numeric = codeMatch?.[1] ?? (/^\d+$/.test(term) ? term : null);

    if (numeric) {
      conditions.push({ number: Number(numeric) });
    }

    return conditions.length > 0 ? { OR: conditions } : {};
  }

  private assertTransition(from: TicketStatus, to: TicketStatus): void {
    if (!canTransition(from, to)) {
      const allowed = TICKET_STATUS_TRANSITIONS[from]
        .map((status) => TICKET_STATUS_LABELS[status])
        .join(', ');

      throw new BadRequestException(
        `No se puede pasar de "${TICKET_STATUS_LABELS[from]}" a "${TICKET_STATUS_LABELS[to]}". ` +
          `Transiciones permitidas: ${allowed}.`,
      );
    }
  }

  /**
   * Marcas temporales derivadas del cambio de estado.
   *
   * Cerrar no implica resolver: un ticket puede cerrarse por duplicado o por
   * falta de informacion, y contarlo como resuelto falsearia el indicador.
   * Reabrir limpia ambas marcas.
   */
  private statusSideEffects(current: Ticket, next: TicketStatus): Prisma.TicketUpdateInput {
    const now = new Date();
    const data: Prisma.TicketUpdateInput = { status: next };

    if (!current.firstResponseAt && current.status === 'NEW') {
      data.firstResponseAt = now;
    }

    if (next === 'RESOLVED') {
      data.resolvedAt = now;
      data.closedAt = null;
    } else if (next === 'CLOSED') {
      data.closedAt = now;
    } else {
      data.resolvedAt = null;
      data.closedAt = null;
    }

    return data;
  }

  /**
   * Cierre asistido de una resolucion: mensaje al cliente y borrador de articulo.
   *
   * El mensaje lleva origen `AI` solo si lo escribio la IA; sin ella sale el
   * texto de plantilla como mensaje del panel. El articulo queda como
   * **borrador**: publicar sin que nadie lo lea lo que un modelo dedujo de un
   * ticket llenaria la base de conocimiento de soluciones a medias. Sin IA no
   * se crea ninguno.
   *
   * Nada de esto puede tumbar la resolucion, que ya esta guardada: un fallo se
   * registra y se sigue.
   */
  private async closeWithAssistant(current: Ticket, actorId: string): Promise<void> {
    const code = formatTicketCode(current.number);

    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: current.id },
        select: { subject: true, description: true, categoryId: true },
      });

      if (!ticket) return;

      const reply = await this.aiService.resolutionReply(ticket.subject, ticket.description);

      await this.prisma.message.create({
        data: {
          ticketId: current.id,
          body: reply.text,
          visibility: MESSAGE_VISIBILITIES.PUBLIC,
          source: reply.byAi ? MESSAGE_SOURCES.AI : MESSAGE_SOURCES.PANEL,
        },
      });

      const article = await this.aiService.generateKnowledgeArticle(
        ticket.subject,
        ticket.description,
        reply.text,
      );

      if (!article) return;

      await this.prisma.article.create({
        data: {
          title: article.title,
          slug: await this.articleSlug(article.title, code),
          summary: article.summary,
          content: article.content,
          categoryId: ticket.categoryId,
          authorId: actorId,
          isPublished: false,
        },
      });

      this.logger.log(`${code}: borrador de articulo generado para la base de conocimiento`);
    } catch (error) {
      this.logger.warn(
        `${code}: cierre asistido incompleto: ${error instanceof Error ? error.message : 'error desconocido'}`,
      );
    }
  }

  /**
   * Slug libre para el articulo.
   *
   * Lleva el codigo del ticket para que dos resoluciones con el mismo titulo
   * —un ticket que se reabre y se vuelve a resolver— no choquen.
   */
  private async articleSlug(title: string, code: string): Promise<string> {
    const base = `${slugify(title) || 'solucion'}-${code.toLowerCase()}`;

    const taken = await this.prisma.article.findUnique({ where: { slug: base }, select: { id: true } });

    return taken ? `${base}-${Date.now().toString(36)}` : base;
  }

  /* ---------------------------------------------------------------------------
   * Avisos
   * ------------------------------------------------------------------------ */

  /**
   * Avisos derivados de un alta.
   *
   * Se emiten dentro de la transaccion del ticket: si el alta se revierte, el
   * aviso no queda colgado apuntando a un ticket que nunca existio.
   */
  private async notifyOnCreate(
    tx: Prisma.TransactionClient,
    ticket: Ticket,
    actorId: string | null,
  ): Promise<void> {
    const label = NotificationsService.ticketLabel(ticket.number, ticket.subject);

    // Nadie necesita que le avisen de lo que acaba de hacer.
    if (ticket.assigneeId && ticket.assigneeId !== actorId) {
      await this.notifications.notify(
        {
          userId: ticket.assigneeId,
          type: NOTIFICATION_TYPES.TICKET_ASSIGNED,
          title: 'Se te ha asignado un ticket',
          body: label,
          ticketId: ticket.id,
        },
        tx,
      );

      return;
    }

    // Una incidencia critica que entra sin responsable no puede quedarse
    // esperando a que alguien mire la bandeja: se avisa a todo el equipo.
    if (ticket.priority === 'CRITICAL' && !ticket.assigneeId) {
      const admins = await tx.user.findMany({
        where: { role: 'ADMIN', status: 'ACTIVE', ...(actorId ? { id: { not: actorId } } : {}) },
        select: { id: true },
      });

      for (const admin of admins) {
        await this.notifications.notify(
          {
            userId: admin.id,
            type: NOTIFICATION_TYPES.TICKET_CRITICAL,
            title: 'Incidencia critica sin responsable',
            body: label,
            ticketId: ticket.id,
          },
          tx,
        );
      }
    }
  }

  /** Avisos derivados de una edicion: reasignacion y cambio de estado. */
  private async notifyOnUpdate(
    tx: Prisma.TransactionClient,
    current: Ticket,
    dto: UpdateTicketDto,
    actorId: string,
  ): Promise<void> {
    const label = NotificationsService.ticketLabel(current.number, dto.subject ?? current.subject);

    const assigneeChanged = dto.assigneeId !== undefined && dto.assigneeId !== current.assigneeId;

    if (assigneeChanged && dto.assigneeId && dto.assigneeId !== actorId) {
      await this.notifications.notify(
        {
          userId: dto.assigneeId,
          type: NOTIFICATION_TYPES.TICKET_ASSIGNED,
          title: 'Se te ha asignado un ticket',
          body: label,
          ticketId: current.id,
        },
        tx,
      );
    }

    if (dto.status && dto.status !== current.status) {
      // Quien recibe el aviso es el responsable resultante, que puede ser el
      // recien asignado en esta misma edicion.
      const recipient = assigneeChanged ? dto.assigneeId : current.assigneeId;

      if (recipient && recipient !== actorId) {
        await this.notifications.notify(
          {
            userId: recipient,
            type: NOTIFICATION_TYPES.TICKET_STATUS_CHANGED,
            title: `Ticket ahora en "${TICKET_STATUS_LABELS[dto.status]}"`,
            body: label,
            ticketId: current.id,
          },
          tx,
        );
      }
    }
  }

  /** Escribe el historial dentro de la misma transaccion que el cambio. */
  private async writeEvents(
    tx: Prisma.TransactionClient,
    ticketId: string,
    actorId: string | null,
    events: PendingEvent[],
  ): Promise<void> {
    if (events.length === 0) return;

    await tx.ticketEvent.createMany({
      data: events.map((event) => ({
        ticketId,
        actorId,
        type: event.type,
        fromValue: event.fromValue ?? null,
        toValue: event.toValue ?? null,
        note: event.note ?? null,
      })),
    });
  }

  /**
   * Comprueba que las entidades referenciadas existen y son coherentes.
   * En particular, un servicio solo puede asociarse a un ticket de su propio
   * cliente, y el responsable debe ser un administrador activo.
   */
  private async assertRelations(
    clientId: string,
    projectId?: string | null,
    categoryId?: string | null,
    assigneeId?: string | null,
  ): Promise<void> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, status: true },
    });

    if (!client) {
      throw new NotFoundException('El cliente indicado no existe');
    }

    if (projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { clientId: true },
      });

      if (!project) {
        throw new NotFoundException('El servicio indicado no existe');
      }

      if (project.clientId !== clientId) {
        throw new BadRequestException('El servicio seleccionado pertenece a otro cliente');
      }
    }

    if (categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: categoryId },
        select: { id: true },
      });

      if (!category) {
        throw new NotFoundException('La categoria indicada no existe');
      }
    }

    if (assigneeId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: assigneeId },
        select: { role: true, status: true },
      });

      if (!assignee) {
        throw new NotFoundException('El responsable indicado no existe');
      }

      if (assignee.role !== 'ADMIN' || assignee.status !== 'ACTIVE') {
        throw new BadRequestException(
          'El responsable debe ser un administrador con la cuenta activa',
        );
      }
    }
  }

  private async categoryName(categoryId: string | null | undefined): Promise<string | null> {
    if (!categoryId) return null;

    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { name: true },
    });

    return category?.name ?? null;
  }

  private async userName(userId: string | null | undefined): Promise<string | null> {
    if (!userId) return null;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    return user?.name ?? null;
  }
}
