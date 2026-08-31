import {
  canTransition,
  formatTicketCode,
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
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import {
  paginate,
  type PaginationQueryDto,
  searchFilter,
  toSkipTake,
} from '../common/dto/pagination.dto';
import { PrismaService } from '../database/prisma.service';
import { Prisma, type Ticket } from '../generated/prisma/client';
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

  constructor(private readonly prisma: PrismaService) {}

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

  async create(dto: CreateTicketDto, actorId: string): Promise<TicketDetail> {
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
          ...(dto.priority ? { priority: dto.priority } : {}),
        },
      });

      const events: PendingEvent[] = [{ type: TICKET_EVENT_TYPES.CREATED }];

      if (dto.assigneeId) {
        const assignee = await tx.user.findUnique({
          where: { id: dto.assigneeId },
          select: { name: true },
        });

        events.push({ type: TICKET_EVENT_TYPES.ASSIGNED, toValue: assignee?.name ?? null });
      }

      await this.writeEvents(tx, ticket.id, actorId, events);

      return ticket;
    });

    this.logger.log(`Ticket ${formatTicketCode(created.number)} creado por ${actorId}`);

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
    });

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

  /** Escribe el historial dentro de la misma transaccion que el cambio. */
  private async writeEvents(
    tx: Prisma.TransactionClient,
    ticketId: string,
    actorId: string,
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
