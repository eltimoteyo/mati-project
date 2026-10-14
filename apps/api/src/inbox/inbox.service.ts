import {
  type AiTicketDraft,
  type InboxConversation,
  type InboxConversationDetail,
  type InboxMessage,
  type PaginatedData,
  type TicketDetail,
  WHATSAPP_AI_HANDOFF_HOURS,
} from '@conit/types';
import { VALIDATION_RULES } from '@conit/validation';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AiService } from '../ai/ai.service';
import { paginate, type PaginationQueryDto, toSkipTake } from '../common/dto/pagination.dto';
import type { AppConfig } from '../config/configuration';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import type { CreateTicketDto } from '../tickets/dto/create-ticket.dto';
import { TicketsService } from '../tickets/tickets.service';
import { WhatsappCloudService } from '../whatsapp/whatsapp-cloud.service';
import {
  WHATSAPP_MESSAGE_RELATIONS,
  WhatsappConversationsService,
} from '../whatsapp/whatsapp-conversations.service';
import type { InboxQueryDto, InboxReplyDto } from './dto/inbox.dto';
import {
  CONVERSATION_LIST_RELATIONS,
  replyWindowEnd,
  toInboxConversation,
  toInboxMessage,
  toInboxTicketRef,
} from './inbox.mapper';
import { InboxAutoReplyService } from './inbox-autoreply.service';
import type { MetaWebhookEvents } from './meta-webhook';

/** Mensajes que se cargan al abrir una conversacion. */
const DETAIL_MESSAGE_LIMIT = 200;

/** Mensajes que se le pasan a la IA para proponer un ticket. */
const DRAFT_MESSAGE_LIMIT = 30;

/** Recorte de cada mensaje en el contexto de la IA. */
const DRAFT_MESSAGE_EXCERPT = 600;

const TICKET_RULES = VALIDATION_RULES.ticket;

/** Cuanto se aparta la IA cuando una persona responde o la pausa a mano. */
const HANDOFF_MS = WHATSAPP_AI_HANDOFF_HOURS * 60 * 60 * 1000;

/**
 * Bandeja de WhatsApp.
 *
 * Recibe lo que escriben los contactos, deja responder dentro de la ventana
 * de 24 horas y convierte una conversacion en ticket cuando quien la atiende
 * lo decide. Nada se crea solo: un "hola" o una pregunta rapida no son una
 * incidencia, y llenar la cola de tickets con eso la haria inservible.
 */
@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);
  private readonly config: AppConfig['whatsapp']['cloud'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly conversations: WhatsappConversationsService,
    private readonly whatsappCloud: WhatsappCloudService,
    private readonly ticketsService: TicketsService,
    private readonly aiService: AiService,
    private readonly autoReply: InboxAutoReplyService,
    configService: ConfigService<AppConfig, true>,
  ) {
    this.config = configService.get('whatsapp', { infer: true }).cloud;
  }

  /* ---------------------------------------------------------------------------
   * Webhook
   * ------------------------------------------------------------------------ */

  /** Clave para comprobar firmas; `undefined` mientras la recepcion no este configurada. */
  get appSecret(): string | undefined {
    return this.config.inboundEnabled ? this.config.appSecret : undefined;
  }

  /** Token del registro del webhook; `undefined` mientras la recepcion no este configurada. */
  get verifyToken(): string | undefined {
    return this.config.inboundEnabled ? this.config.verifyToken : undefined;
  }

  /** Numero propio: los eventos de otros numeros de la misma app se ignoran. */
  get phoneNumberId(): string | undefined {
    return this.config.phoneNumberId;
  }

  /** Registra lo que trae un webhook ya verificado. */
  async receive(events: MetaWebhookEvents): Promise<void> {
    // Una linea por aviso: si Meta cambia el formato y deja de entenderse,
    // aqui se ve que llego aunque no se haya registrado nada.
    this.logger.log(
      `Webhook de Meta (${events.fields.join(', ') || 'sin campos'}): ` +
        `${events.messages.length} mensajes, ${events.statuses.length} estados`,
    );

    for (const message of events.messages) {
      const conversationId = await this.conversations.recordInbound(message);

      if (conversationId) {
        this.logger.log(`WhatsApp recibido de ***${message.phone.slice(-4)} (${message.type})`);

        // En segundo plano: Meta espera la respuesta al webhook en segundos y
        // la IA puede tardar bastante mas.
        this.autoReply.schedule(conversationId);
      }
    }

    for (const status of events.statuses) {
      await this.conversations.updateStatus(status);
    }

    if (events.ignoredNumbers.length > 0) {
      this.logger.log(
        `Webhook firmado para otro numero (${events.ignoredNumbers.join(', ')}) ignorado; ` +
          'las pruebas del panel de Meta usan un numero ficticio',
      );
    }
  }

  /* ---------------------------------------------------------------------------
   * Lectura
   * ------------------------------------------------------------------------ */

  async findAll(query: InboxQueryDto): Promise<PaginatedData<InboxConversation>> {
    const where: Prisma.WhatsappConversationWhereInput = {
      ...(query.unreadOnly ? { unreadCount: { gt: 0 } } : {}),
      ...this.buildSearch(query.search),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.whatsappConversation.findMany({
        where,
        include: CONVERSATION_LIST_RELATIONS,
        orderBy: { lastMessageAt: 'desc' },
        ...toSkipTake(query as PaginationQueryDto),
      }),
      this.prisma.whatsappConversation.count({ where }),
    ]);

    const now = new Date();

    return paginate(
      items.map((item) => toInboxConversation(item, now)),
      total,
      query as PaginationQueryDto,
    );
  }

  async findOne(id: string): Promise<InboxConversationDetail> {
    const conversation = await this.prisma.whatsappConversation.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true } },
        // Los mas recientes, que son los que importan; se reordenan abajo.
        messages: {
          orderBy: { createdAt: 'desc' },
          take: DETAIL_MESSAGE_LIMIT,
          include: WHATSAPP_MESSAGE_RELATIONS,
        },
        tickets: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, number: true, subject: true, status: true, createdAt: true },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('La conversacion no existe');
    }

    return {
      ...toInboxConversation(conversation),
      // Un chat se lee de arriba abajo.
      messages: [...conversation.messages].reverse().map(toInboxMessage),
      tickets: conversation.tickets.map(toInboxTicketRef),
    };
  }

  /** Marca la conversacion como vista por el equipo. */
  async markRead(id: string): Promise<void> {
    const { count } = await this.prisma.whatsappConversation.updateMany({
      where: { id },
      data: { unreadCount: 0 },
    });

    if (count === 0) {
      throw new NotFoundException('La conversacion no existe');
    }
  }

  /* ---------------------------------------------------------------------------
   * Responder
   * ------------------------------------------------------------------------ */

  /**
   * Responde por WhatsApp.
   *
   * Fuera de la ventana de 24 horas se rechaza aqui mismo: Meta aceptaria la
   * peticion y descartaria el mensaje despues, y quien atiende creeria haber
   * contestado.
   */
  async reply(id: string, dto: InboxReplyDto, authorId: string): Promise<InboxMessage> {
    const conversation = await this.load(id);

    if (!this.whatsappCloud.isEnabled()) {
      throw new ServiceUnavailableException('El envio por WhatsApp no esta configurado');
    }

    const windowEnd = replyWindowEnd(conversation.lastInboundAt);

    if (!windowEnd || windowEnd <= new Date()) {
      throw new ConflictException(
        'Han pasado mas de 24 horas desde el ultimo mensaje del contacto. WhatsApp solo ' +
          'permite volver a escribirle cuando el escriba de nuevo.',
      );
    }

    const result = await this.whatsappCloud.sendText({ to: conversation.phone, body: dto.body });

    if (!result.sent) {
      throw new BadGatewayException(
        `WhatsApp no acepto el mensaje: ${result.reason ?? 'sin detalle'}`,
      );
    }

    const message = await this.conversations.recordOutbound({
      phone: conversation.phone,
      externalId: result.id ?? null,
      type: 'text',
      body: dto.body,
      authorId,
    });

    // Una persona tomo la conversacion: la IA se aparta para no contestar
    // por encima de ella.
    await this.conversations.pauseAi(conversation.id, new Date(Date.now() + HANDOFF_MS));

    return toInboxMessage(message);
  }

  /** Pausa o reanuda la respuesta automatica en la conversacion. */
  async setAiPaused(id: string, paused: boolean): Promise<InboxConversationDetail> {
    const conversation = await this.load(id);

    await this.conversations.pauseAi(
      conversation.id,
      paused ? new Date(Date.now() + HANDOFF_MS) : null,
    );

    // Al reanudar, si el contacto escribio y nadie le contesto, se atiende ya.
    if (!paused) this.autoReply.schedule(conversation.id);

    return this.findOne(conversation.id);
  }

  /* ---------------------------------------------------------------------------
   * Convertir en ticket
   * ------------------------------------------------------------------------ */

  /**
   * Crea un ticket a partir de la conversacion.
   *
   * Pasa por el mismo alta que el formulario de tickets —historial, avisos y
   * acuse por correo incluidos— y queda enlazado a la conversacion. Si el
   * numero era desconocido, se asocia al cliente elegido: los siguientes
   * mensajes ya llegan con su nombre.
   */
  async createTicket(id: string, dto: CreateTicketDto, actorId: string): Promise<TicketDetail> {
    const conversation = await this.load(id);

    const ticket = await this.ticketsService.create(dto, actorId, {
      whatsappConversationId: conversation.id,
      note: `Creado desde la bandeja de WhatsApp (+${conversation.phone})`,
    });

    if (!conversation.clientId) {
      await this.prisma.whatsappConversation.update({
        where: { id: conversation.id },
        data: { clientId: dto.clientId },
      });
    }

    return ticket;
  }

  /**
   * Borrador de ticket propuesto por la IA.
   *
   * Se analiza lo ocurrido desde el ultimo ticket creado en esta conversacion:
   * lo anterior ya tiene su ticket, y mezclarlo confundiria al modelo con un
   * problema que ya esta registrado.
   */
  async draftTicket(id: string): Promise<AiTicketDraft> {
    const conversation = await this.prisma.whatsappConversation.findUnique({
      where: { id },
      include: {
        client: { select: { name: true } },
        tickets: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
      },
    });

    if (!conversation) {
      throw new NotFoundException('La conversacion no existe');
    }

    const since = conversation.tickets[0]?.createdAt;

    let messages = await this.loadForDraft(id, since);

    // Si desde el ultimo ticket no ha escrito nada, se usa lo mas reciente.
    if (since && !messages.some((message) => message.direction === 'INBOUND')) {
      messages = await this.loadForDraft(id);
    }

    if (!messages.some((message) => message.direction === 'INBOUND')) {
      throw new BadRequestException('El contacto no ha escrito nada que analizar todavia');
    }

    const contactName =
      conversation.client?.name ?? conversation.profileName ?? `+${conversation.phone}`;

    const transcript = messages
      .map((message) => {
        const speaker =
          message.direction === 'INBOUND'
            ? contactName
            : (message.author?.name ?? 'CONIT (aviso automatico)');

        return `${speaker}: ${message.body.slice(0, DRAFT_MESSAGE_EXCERPT)}`;
      })
      .join('\n');

    const draft = await this.aiService.draftTicketFromChat(
      `${contactName} (+${conversation.phone})`,
      transcript,
    );

    return this.fitTicketRules(draft, contactName, transcript);
  }

  /* ---------------------------------------------------------------------------
   * Apoyo
   * ------------------------------------------------------------------------ */

  private async load(id: string) {
    const conversation = await this.prisma.whatsappConversation.findUnique({ where: { id } });

    if (!conversation) {
      throw new NotFoundException('La conversacion no existe');
    }

    return conversation;
  }

  /** Mensajes en orden cronologico, opcionalmente desde una fecha. */
  private async loadForDraft(conversationId: string, since?: Date) {
    const messages = await this.prisma.whatsappMessage.findMany({
      where: { conversationId, ...(since ? { createdAt: { gt: since } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: DRAFT_MESSAGE_LIMIT,
      select: { direction: true, body: true, author: { select: { name: true } } },
    });

    return messages.reverse();
  }

  /**
   * Ajusta el borrador a las reglas del ticket.
   *
   * El modelo no conoce los limites de longitud; si no se respetan aqui, el
   * boton de crear con un clic fallaria en la validacion.
   */
  private fitTicketRules(
    draft: AiTicketDraft,
    contactName: string,
    transcript: string,
  ): AiTicketDraft {
    const subject = draft.subject.replace(/\s+/g, ' ').trim();
    const description = draft.description.trim();

    return {
      ...draft,
      subject: (subject.length >= TICKET_RULES.subject.minLength
        ? subject
        : `Consulta por WhatsApp de ${contactName}`
      ).slice(0, TICKET_RULES.subject.maxLength),
      description: (description.length >= TICKET_RULES.description.minLength
        ? description
        : transcript
      ).slice(0, TICKET_RULES.description.maxLength),
    };
  }

  /** Busqueda por numero, nombre del perfil o nombre del cliente. */
  private buildSearch(search: string | undefined): Prisma.WhatsappConversationWhereInput {
    const term = search?.trim();

    if (!term) return {};

    const digits = term.replace(/\D/g, '');

    return {
      OR: [
        ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
        { profileName: { contains: term, mode: 'insensitive' } },
        { client: { name: { contains: term, mode: 'insensitive' } } },
      ],
    };
  }
}
