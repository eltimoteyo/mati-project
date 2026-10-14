import {
  type AiTicketDraft,
  formatTicketCode,
  NOTIFICATION_TYPES,
  OPEN_TICKET_STATUSES,
  SERVICE_TYPE_LABELS,
  type ServiceType,
  TICKET_STATUS_LABELS,
  type TicketStatus,
} from '@conit/types';
import { VALIDATION_RULES } from '@conit/validation';
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';

import {
  AiService,
  type WhatsappReplyContext,
  type WhatsappReplyDecision,
} from '../ai/ai.service';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { TicketsService } from '../tickets/tickets.service';
import { WhatsappCloudService } from '../whatsapp/whatsapp-cloud.service';
import { WhatsappConversationsService } from '../whatsapp/whatsapp-conversations.service';
import {
  type DiagnosticTarget,
  domainOf,
  extractMentionedHosts,
  mailDomainOf,
  runDiagnostics,
} from './service-diagnostics';

/**
 * Espera tras el ultimo mensaje antes de contestar.
 *
 * En WhatsApp es habitual escribir en varios mensajes seguidos ("hola" /
 * "tengo un problema" / "con el correo"); contestar al primero dejaria una
 * respuesta a medias. Cada mensaje nuevo reinicia la espera.
 */
const DEBOUNCE_MS = 6_000;

/** Mensajes de la conversacion que se le pasan a la IA. */
const CONTEXT_MESSAGE_LIMIT = 20;

/** Recorte de cada mensaje en el contexto. */
const MESSAGE_EXCERPT = 600;

/** Articulos relacionados que se le pasan a la IA, y cuanto de cada uno. */
const KNOWLEDGE_LIMIT = 3;
const KNOWLEDGE_EXCERPT = 1_500;

/**
 * Respuestas automaticas maximas por conversacion y hora.
 *
 * Una IA que lleva diez respuestas en una hora no esta resolviendo nada: a
 * partir de ahi se deriva a una persona en lugar de seguir conversando.
 */
const MAX_REPLIES_PER_HOUR = 10;

/**
 * Intentos de diagnostico antes de derivar.
 *
 * Un intento es un mensaje con causas probables y pasos para probar. Al
 * tercero se deriva aunque la IA quiera seguir: el cliente ya dedico tiempo y
 * necesita a alguien que pueda tocar el servicio.
 */
const MAX_TROUBLESHOOT_ATTEMPTS = 2;

/** Ventana en la que se cuentan los intentos y dura el seguimiento sin ticket. */
const ISSUE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Limites de las comprobaciones automaticas por respuesta. */
const MAX_CHECKED_URLS = 4;
const MAX_CHECKED_DOMAINS = 3;

/**
 * Indicios de que el mensaje habla de un servicio que se puede comprobar. Sin
 * ellos ("hola", "gracias") no se lanza ninguna comprobacion.
 */
const DIAGNOSTIC_HINTS =
  /web|p[aá]gina|sitio|correo|mail|dominio|ssl|certificad|segur|carga|ca[ií]d|lent|error|no abre|no entra|acceso|aula|plataforma|sistema|servidor|dns|https?:\/\/|www\./i;

/** El cliente describe un fallo (no una consulta ni una peticion). */
const PROBLEM_HINTS =
  /no (env[ií]a|llega|carga|funciona|abre|entra|puedo|sale|deja|conecta)|error|ca[ií]d|lent|falla|problema|bloque|en blanco/i;

/** El cliente pide que lo atienda una persona. */
const HUMAN_HINTS = /persona|humano|agente|asesor|t[eé]cnico|ll[aá]m(en|ame)|hablar con|alguien/i;

/** Datos o seguridad en juego: no se hace esperar al cliente con pasos. */
const URGENT_HINTS = /borr|elimin|perd[ií]|hack|virus|seguridad|robo|filtr|urgente/i;

/** Las comprobaciones automaticas muestran un fallo del lado de CONIT. */
const FAILURE_HINTS = /no responde|VENCIDO|NO resuelve|error del servidor|no existe|no es valido|NO tiene registros|vence pronto/;

/** Firma de lo que escribe la IA: el cliente debe saber que no es una persona. */
const SIGNATURE = '\n\n_Asistente virtual de CONIT_';

const TICKET_RULES = VALIDATION_RULES.ticket;

/** Palabras que no ayudan a encontrar articulos relacionados. */
const STOPWORDS = new Set(
  (
    'hola buenas buenos tardes noches dias gracias favor para como esta este esto estos ' +
    'desde tengo tiene tienen quiero queria necesito ayuda pero porque cuando donde sobre ' +
    'tambien ahora solo todo toda nada algo hace sigue puede podria pueden estan estamos ' +
    'mismo misma otra otro muchas mucho poco bien igual entonces nuestro nuestra usted ' +
    'ustedes vamos favor saludos'
  ).split(' '),
);

/** Lo que se carga de la conversacion para decidir la respuesta. */
const CONVERSATION_INCLUDE = {
  client: { select: { id: true, name: true, email: true } },
  // Los mas recientes; se reordenan al usarlos.
  messages: {
    orderBy: { createdAt: 'desc' },
    take: CONTEXT_MESSAGE_LIMIT,
    select: {
      direction: true,
      body: true,
      aiGenerated: true,
      aiAction: true,
      createdAt: true,
      author: { select: { name: true } },
    },
  },
} as const;

type ConversationForReply = Prisma.WhatsappConversationGetPayload<{
  include: typeof CONVERSATION_INCLUDE;
}>;

type ChatMessage = ConversationForReply['messages'][number];

/** Ticket abierto de la conversacion, cuando esta en seguimiento. */
interface FollowUpTicket {
  id: string;
  code: string;
  subject: string;
  status: TicketStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  updatedAt: Date;
}

/**
 * Respuesta automatica de la bandeja de WhatsApp.
 *
 * Funciona como un primer nivel de soporte:
 *
 *  1. **Atiende.** Contesta saludos y dudas, y ante un problema explica que
 *     podria estar pasando y propone pasos, apoyandose en los servicios del
 *     cliente, en comprobaciones automaticas y en la base de conocimiento.
 *  2. **Deriva** cuando no lo resuelve en `MAX_TROUBLESHOOT_ATTEMPTS` intentos,
 *     cuando hace falta el equipo o cuando no puede responder: crea el ticket
 *     (si el numero es de un cliente), le explica al cliente lo que cree que
 *     pasa y le da el codigo.
 *  3. **Hace seguimiento** mientras el ticket siga abierto: responde con su
 *     estado real para que el cliente no quede sin respuesta.
 *
 * Calla solo cuando interviene una persona del equipo, que la pausa al
 * responder desde la bandeja. Sin proveedor de IA configurado no hace nada.
 *
 * La espera entre mensajes vive en memoria. Con una sola instancia de la API
 * es suficiente; si se reinicia durante la espera, ese mensaje queda para que
 * lo atienda una persona.
 */
@Injectable()
export class InboxAutoReplyService implements OnModuleDestroy {
  private readonly logger = new Logger(InboxAutoReplyService.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();
  /** Conversaciones con una respuesta en curso. */
  private readonly running = new Set<string>();
  /** Conversaciones que recibieron mensajes mientras se respondia. */
  private readonly pending = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly aiService: AiService,
    private readonly whatsappCloud: WhatsappCloudService,
    private readonly conversations: WhatsappConversationsService,
    private readonly ticketsService: TicketsService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleDestroy(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
  }

  /** Programa la respuesta; cada mensaje nuevo de la conversacion reinicia la espera. */
  schedule(conversationId: string): void {
    clearTimeout(this.timers.get(conversationId));

    this.timers.set(
      conversationId,
      setTimeout(() => {
        this.timers.delete(conversationId);
        void this.run(conversationId);
      }, DEBOUNCE_MS),
    );
  }

  private async run(conversationId: string): Promise<void> {
    // Una sola respuesta a la vez por conversacion: lo que llegue mientras
    // tanto se atiende al terminar, con el contexto ya actualizado.
    if (this.running.has(conversationId)) {
      this.pending.add(conversationId);

      return;
    }

    this.running.add(conversationId);

    try {
      await this.respond(conversationId);
    } catch (error) {
      this.logger.error(
        `Respuesta automatica fallida en la conversacion ${conversationId}: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
    } finally {
      this.running.delete(conversationId);

      if (this.pending.delete(conversationId)) this.schedule(conversationId);
    }
  }

  private async respond(conversationId: string): Promise<void> {
    const { whatsappAutoReply } = await this.settings.getAutomation();

    if (!whatsappAutoReply || !this.aiService.isAvailable() || !this.whatsappCloud.isEnabled()) {
      return;
    }

    const conversation = await this.load(conversationId);

    if (!conversation) return;

    // Solo calla cuando interviene una persona del equipo.
    if (conversation.aiPausedUntil && conversation.aiPausedUntil > new Date()) return;

    const messages = [...conversation.messages].reverse();

    // Solo hay algo pendiente si lo ultimo lo escribio el contacto: si ya le
    // contesto alguien (o la propia IA), no se responde dos veces.
    if (messages.at(-1)?.direction !== 'INBOUND') return;

    const followUp = await this.followUpTicket(conversation.id);
    const escalatedWithoutTicket = followUp ? null : this.lastEscalation(messages);
    const issueStart = await this.issueStart(conversation.id);

    const [recentReplies, attempts, projects] = await Promise.all([
      this.prisma.whatsappMessage.count({
        where: {
          conversationId,
          aiGenerated: true,
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
      }),
      this.prisma.whatsappMessage.count({
        where: { conversationId, aiAction: 'troubleshoot', createdAt: { gt: issueStart } },
      }),
      conversation.clientId
        ? this.prisma.project.findMany({
            where: { clientId: conversation.clientId, status: { not: 'ARCHIVED' } },
            select: { name: true, type: true, url: true, status: true, expiresAt: true },
            orderBy: { name: 'asc' },
          })
        : Promise.resolve([]),
    ]);

    // En seguimiento no se vuelve a diagnosticar: no hace falta comprobar nada.
    const diagnostics = followUp ? '' : await this.diagnose(conversation, messages, projects);

    let decision: WhatsappReplyDecision | null = null;

    if (recentReplies < MAX_REPLIES_PER_HOUR) {
      try {
        const context: WhatsappReplyContext = {
          contact: this.contactLine(conversation),
          services: this.servicesText(projects),
          diagnostics,
          openTickets: await this.openTickets(conversation.clientId),
          followUp: followUp
            ? this.followUpText(followUp)
            : escalatedWithoutTicket
              ? `si. Se paso al equipo de soporte el ${this.shortDate(escalatedWithoutTicket)}, sin ticket porque el numero no esta registrado; nadie del equipo ha respondido todavia.`
              : '',
          troubleshootAttempts: attempts,
          maxTroubleshootAttempts: MAX_TROUBLESHOOT_ATTEMPTS,
          knowledge: await this.knowledge(messages),
          transcript: this.transcript(conversation, messages),
        };

        decision = await this.aiService.decideWhatsappReply(context);

        // Los modelos pequenos tienden a preguntar o derivar en cuanto oyen
        // un problema. Si no hay motivo para saltarse el primer nivel, se les
        // pide una segunda respuesta con el diagnostico; si tampoco la dan, se
        // usa la primera.
        if (
          !followUp &&
          !escalatedWithoutTicket &&
          attempts === 0 &&
          this.shouldDiagnoseFirst(decision, this.recentInbound(messages), diagnostics)
        ) {
          const retry = await this.aiService
            .decideWhatsappReply(context, { requireTroubleshoot: true })
            .catch(() => null);

          if (retry?.action === 'troubleshoot') {
            this.logger.log(`Conversacion ${conversationId}: se pidio diagnosticar antes de ${decision.action}`);
            decision = retry;
          }
        }
      } catch (error) {
        this.logger.warn(
          `La IA no pudo atender la conversacion ${conversationId}: ${
            error instanceof Error ? error.message : 'error desconocido'
          }`,
        );
      }
    } else {
      this.logger.warn(`Conversacion ${conversationId}: limite de respuestas de IA alcanzado`);
    }

    // --- Seguimiento: ya esta derivada ---------------------------------------
    if (followUp || escalatedWithoutTicket) {
      await this.followUpReply(conversation, followUp, decision);

      return;
    }

    // --- Atencion normal ------------------------------------------------------
    if (decision?.action === 'reply') {
      await this.send(conversation, decision.message, 'reply');
      this.logger.log(
        `IA respondio en la conversacion ${conversationId} (${decision.model}): ${this.brief(decision.reasoning)}`,
      );

      return;
    }

    if (decision?.action === 'troubleshoot' && attempts < MAX_TROUBLESHOOT_ATTEMPTS) {
      await this.send(conversation, decision.message, 'troubleshoot');
      this.logger.log(
        `IA propuso un diagnostico en la conversacion ${conversationId} ` +
          `(intento ${attempts + 1} de ${MAX_TROUBLESHOOT_ATTEMPTS}, ${decision.model}): ${this.brief(decision.reasoning)}`,
      );

      return;
    }

    // La IA no respondio (cupo agotado, proveedor caido...) y el contacto no
    // ha descrito ningun problema: un "hola" no merece un ticket. Se le dice
    // que lo atendera una persona y se avisa al equipo.
    if (!decision && !PROBLEM_HINTS.test(this.recentInbound(messages))) {
      await this.holdForTeam(conversation, messages);

      return;
    }

    // Deriva: lo pidio la IA, se agotaron los intentos o la IA no respondio.
    const forced = decision?.action === 'troubleshoot';

    await this.escalate(conversation, messages, decision, diagnostics, issueStart, forced);
  }

  /* ---------------------------------------------------------------------------
   * Derivar
   * ------------------------------------------------------------------------ */

  /**
   * Deriva la conversacion al equipo.
   *
   * Con cliente conocido se crea el ticket con lo que la IA averiguo y se le
   * da el codigo. Con un numero desconocido no se puede —un ticket exige
   * cliente—, asi que se avisa al equipo para que lo identifique. La IA no se
   * aparta: queda en seguimiento para responder al cliente mientras espera.
   */
  private async escalate(
    conversation: ConversationForReply,
    messages: ChatMessage[],
    decision: WhatsappReplyDecision | null,
    diagnostics: string,
    issueStart: Date,
    forced: boolean,
  ): Promise<void> {
    const explanation = forced
      ? 'Como el problema continúa después de lo que revisamos, lo pasamos al equipo técnico para que lo atienda directamente.'
      : decision?.action === 'escalate'
        ? decision.message
        : '';

    if (!conversation.client) {
      await this.send(
        conversation,
        this.joinParagraphs(
          explanation,
          'Hemos pasado tu consulta al equipo de soporte de CONIT y en seguida te contactaremos para ayudarte.',
        ),
        'escalate',
      );

      const last = messages.at(-1)?.body ?? '';

      await this.notifyAdmins(
        'WhatsApp de un numero no registrado',
        `+${conversation.phone}: ${last}`.slice(0, 500),
        null,
      );

      this.logger.log(`Conversacion ${conversation.id} derivada al equipo (numero desconocido)`);

      return;
    }

    const ticket = await this.createTicket(conversation, messages, decision?.draft ?? null, diagnostics, issueStart);

    await this.send(
      conversation,
      this.joinParagraphs(
        explanation,
        `Hemos registrado tu solicitud con el código ${ticket.code} y el equipo de soporte ya la ` +
          'está revisando. En seguida te informaremos o te daremos más detalles por este medio.',
      ),
      'escalate',
    );

    this.logger.log(
      `Conversacion ${conversation.id} derivada al ticket ${ticket.code}` +
        `${forced ? ' (intentos agotados)' : ''}${decision ? `: ${this.brief(decision.reasoning)}` : ' (la IA no respondio)'}`,
    );
  }

  private async createTicket(
    conversation: ConversationForReply,
    messages: ChatMessage[],
    draft: AiTicketDraft | null,
    diagnostics: string,
    issueStart: Date,
  ): Promise<{ code: string }> {
    const clientId = conversation.clientId as string;
    const contactName = conversation.client?.name ?? `+${conversation.phone}`;

    // Solo lo escrito desde que empezo el problema actual: los saludos de
    // otros dias no le sirven a quien lo atienda.
    const inbound = messages.filter(
      (message) => message.direction === 'INBOUND' && message.createdAt > issueStart,
    );

    const subject = this.fit(
      (draft?.subject || inbound[0]?.body || '').replace(/\s+/g, ' '),
      TICKET_RULES.subject,
      `Consulta por WhatsApp de ${contactName}`,
    );

    const description = this.fit(
      [
        draft?.description,
        diagnostics ? `Comprobaciones automaticas:\n${diagnostics}` : null,
        inbound.length > 0
          ? `Mensajes del cliente por WhatsApp (+${conversation.phone}):\n${inbound
              .slice(-10)
              .map((message) => `- ${message.body}`)
              .join('\n')}`
          : null,
      ]
        .filter(Boolean)
        .join('\n\n'),
      TICKET_RULES.description,
      this.transcript(conversation, messages),
    );

    const ticket = await this.ticketsService.create(
      {
        clientId,
        subject,
        description,
        ...(draft ? { priority: draft.priority, categoryId: draft.categoryId } : {}),
      },
      null,
      {
        whatsappConversationId: conversation.id,
        note: `Creado por el asistente de IA desde WhatsApp (+${conversation.phone})`,
      },
    );

    // Las criticas ya avisan a todo el equipo al crearse; el resto llega sin
    // responsable y tambien necesita que alguien lo vea.
    if (ticket.priority !== 'CRITICAL') {
      await this.notifyAdmins(
        'Ticket creado por la IA desde WhatsApp',
        NotificationsService.ticketLabel(ticket.number, ticket.subject),
        ticket.id,
      );
    }

    return { code: ticket.code };
  }

  /**
   * Respuesta de espera cuando la IA no esta disponible.
   *
   * Se envia una vez por hora como mucho: si el cliente sigue escribiendo
   * mientras tanto, repetirle lo mismo en cada mensaje solo lo irritaria. No
   * cuenta como derivacion (accion `hold`): cuando la IA vuelva, atendera los
   * mensajes siguientes con normalidad.
   */
  private async holdForTeam(
    conversation: ConversationForReply,
    messages: ChatMessage[],
  ): Promise<void> {
    const recentHold = await this.prisma.whatsappMessage.count({
      where: {
        conversationId: conversation.id,
        aiAction: 'hold',
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });

    if (recentHold > 0) return;

    await this.send(
      conversation,
      'Gracias por escribirnos. En este momento no podemos responderte de forma automática; ' +
        'una persona del equipo de soporte de CONIT te atenderá en breve.',
      'hold',
    );

    const contact = conversation.client?.name ?? `+${conversation.phone}`;
    const last = messages.at(-1)?.body ?? '';

    await this.notifyAdmins(
      'WhatsApp sin responder: la IA no esta disponible',
      `${contact}: ${last}`.slice(0, 500),
      null,
    );

    this.logger.warn(`Conversacion ${conversation.id}: IA no disponible; se aviso al equipo sin ticket`);
  }

  /* ---------------------------------------------------------------------------
   * Seguimiento
   * ------------------------------------------------------------------------ */

  /**
   * Respuesta mientras la conversacion espera al equipo.
   *
   * Si la IA no responde, sale un mensaje con el estado real del ticket: el
   * cliente nunca queda sin contestar. Si el cliente insiste o pide una
   * persona, se vuelve a avisar al equipo.
   */
  private async followUpReply(
    conversation: ConversationForReply,
    ticket: FollowUpTicket | null,
    decision: WhatsappReplyDecision | null,
  ): Promise<void> {
    const fallback = ticket
      ? `Tu solicitud ${ticket.code} está en estado "${TICKET_STATUS_LABELS[ticket.status]}" y el ` +
        'equipo de soporte la está atendiendo. Te avisaremos por aquí en cuanto haya novedades.'
      : 'Tu consulta ya está con el equipo de soporte de CONIT y en seguida te contactarán.';

    await this.send(conversation, decision?.message || fallback, 'follow_up');

    if (decision?.action === 'escalate') {
      if (ticket?.assigneeId) {
        await this.notifications.notify({
          userId: ticket.assigneeId,
          type: NOTIFICATION_TYPES.TICKET_MESSAGE,
          title: 'El cliente insiste por WhatsApp',
          body: `${ticket.code}: ${ticket.subject}`.slice(0, 500),
          ticketId: ticket.id,
        });
      } else {
        await this.notifyAdmins(
          'El cliente insiste por WhatsApp',
          ticket ? `${ticket.code}: ${ticket.subject}` : `+${conversation.phone}`,
          ticket?.id ?? null,
        );
      }
    }

    this.logger.log(
      `IA hizo seguimiento en la conversacion ${conversation.id}${ticket ? ` (${ticket.code})` : ''}`,
    );
  }

  /** Ticket abierto mas reciente creado desde la conversacion. */
  private async followUpTicket(conversationId: string): Promise<FollowUpTicket | null> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { whatsappConversationId: conversationId, status: { in: OPEN_TICKET_STATUSES } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        number: true,
        subject: true,
        status: true,
        assigneeId: true,
        updatedAt: true,
        assignee: { select: { name: true } },
      },
    });

    return ticket
      ? {
          id: ticket.id,
          code: formatTicketCode(ticket.number),
          subject: ticket.subject,
          status: ticket.status as TicketStatus,
          assigneeId: ticket.assigneeId,
          assigneeName: ticket.assignee?.name ?? null,
          updatedAt: ticket.updatedAt,
        }
      : null;
  }

  /** Derivacion sin ticket (numero desconocido) en la ventana del problema actual. */
  private lastEscalation(messages: ChatMessage[]): Date | null {
    const escalation = [...messages]
      .reverse()
      .find((message) => message.aiGenerated && message.aiAction === 'escalate');

    return escalation && escalation.createdAt.getTime() > Date.now() - ISSUE_WINDOW_MS
      ? escalation.createdAt
      : null;
  }

  /**
   * Desde cuando cuenta el problema actual: el ultimo ticket de la
   * conversacion o, como mucho, las ultimas 24 horas.
   */
  private async issueStart(conversationId: string): Promise<Date> {
    const lastTicket = await this.prisma.ticket.findFirst({
      where: { whatsappConversationId: conversationId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const windowStart = new Date(Date.now() - ISSUE_WINDOW_MS);

    return lastTicket && lastTicket.createdAt > windowStart ? lastTicket.createdAt : windowStart;
  }

  private followUpText(ticket: FollowUpTicket): string {
    return (
      `si. Ticket ${ticket.code}: "${ticket.subject}". Estado: ${TICKET_STATUS_LABELS[ticket.status]}. ` +
      `Responsable: ${ticket.assigneeName ?? 'todavia sin asignar'}. ` +
      `Ultima actualizacion: ${this.shortDate(ticket.updatedAt)}.`
    );
  }

  /**
   * Si la decision se salta el primer nivel sin motivo.
   *
   * Ante un fallo descrito por el cliente, preguntar sin mas o derivar a la
   * primera deja al cliente sin nada que probar. Se acepta derivar de entrada
   * solo cuando pide una persona, hay datos o seguridad en juego, o las
   * comprobaciones muestran un fallo real. Una peticion que no es un fallo
   * ("necesito una cuenta de correo nueva") se deriva sin mas.
   */
  private shouldDiagnoseFirst(
    decision: WhatsappReplyDecision,
    recentText: string,
    diagnostics: string,
  ): boolean {
    if (decision.action === 'troubleshoot' || !PROBLEM_HINTS.test(recentText)) return false;

    if (decision.action === 'reply') return true;

    return (
      !HUMAN_HINTS.test(recentText) &&
      !URGENT_HINTS.test(recentText) &&
      !FAILURE_HINTS.test(diagnostics)
    );
  }

  /** Lo ultimo que escribio el contacto (hasta tres mensajes). */
  private recentInbound(messages: ChatMessage[]): string {
    return messages
      .filter((message) => message.direction === 'INBOUND')
      .slice(-3)
      .map((message) => message.body)
      .join('\n');
  }

  /* ---------------------------------------------------------------------------
   * Contexto
   * ------------------------------------------------------------------------ */

  private load(conversationId: string): Promise<ConversationForReply | null> {
    return this.prisma.whatsappConversation.findUnique({
      where: { id: conversationId },
      include: CONVERSATION_INCLUDE,
    });
  }

  /**
   * Comprobaciones automaticas de los servicios del cliente y de lo que
   * mencione en el chat. Solo si lo ultimo que escribio habla de algo
   * comprobable: un "gracias" no merece una ronda de peticiones.
   */
  private async diagnose(
    conversation: ConversationForReply,
    messages: ChatMessage[],
    projects: Array<{ name: string; type: string; url: string | null }>,
  ): Promise<string> {
    const recent = messages
      .filter((message) => message.direction === 'INBOUND')
      .slice(-3)
      .map((message) => message.body)
      .join('\n');

    const mentioned = extractMentionedHosts(recent);

    if (!DIAGNOSTIC_HINTS.test(recent) && mentioned.length === 0) return '';

    const urls = new Map<string, DiagnosticTarget>();
    const domains = new Map<string, DiagnosticTarget>();

    // Primero lo que menciona el cliente: es de lo que esta hablando.
    for (const host of mentioned) {
      const domain = domainOf(host);

      urls.set(host, { label: 'mencionado por el cliente', url: host });
      if (domain) domains.set(domain, { label: 'mencionado por el cliente', domain });
    }

    for (const project of projects) {
      if (!project.url) continue;

      const label = `${project.name}, ${SERVICE_TYPE_LABELS[project.type as ServiceType] ?? project.type}`;
      const domain = domainOf(project.url);

      urls.set(project.url, { label, url: project.url });
      if (domain && !domains.has(domain)) domains.set(domain, { label, domain });
    }

    // El dominio de su correo, si no es de un proveedor generico.
    const mailDomain = mailDomainOf(conversation.client?.email);

    if (mailDomain && !domains.has(mailDomain)) {
      domains.set(mailDomain, { label: 'dominio del correo del cliente', domain: mailDomain });
    }

    const targets = [
      ...[...urls.values()].slice(0, MAX_CHECKED_URLS),
      ...[...domains.values()].slice(0, MAX_CHECKED_DOMAINS),
    ];

    if (targets.length === 0) return '';

    const lines = await runDiagnostics(targets);

    return lines.map((line) => `- ${line}`).join('\n');
  }

  private servicesText(
    projects: Array<{
      name: string;
      type: string;
      url: string | null;
      status: string;
      expiresAt: Date | null;
    }>,
  ): string {
    return projects
      .map((project) => {
        const days = project.expiresAt
          ? Math.floor((project.expiresAt.getTime() - Date.now()) / 86_400_000)
          : null;
        const expiry =
          days === null
            ? ''
            : days < 0
              ? ` · VENCIO hace ${-days} dias`
              : ` · vence el ${project.expiresAt?.toISOString().slice(0, 10)} (en ${days} dias)`;

        return (
          `- ${project.name} (${SERVICE_TYPE_LABELS[project.type as ServiceType] ?? project.type})` +
          `${project.url ? ` ${project.url}` : ''}` +
          `${project.status === 'ACTIVE' ? '' : ' · SUSPENDIDO'}${expiry}`
        );
      })
      .join('\n');
  }

  /** Tickets abiertos del cliente, para que la IA pueda responder "como va lo mio". */
  private async openTickets(clientId: string | null): Promise<string> {
    if (!clientId) return '';

    const tickets = await this.prisma.ticket.findMany({
      where: { clientId, status: { in: OPEN_TICKET_STATUSES } },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: { number: true, subject: true, status: true, updatedAt: true },
    });

    return tickets
      .map(
        (ticket) =>
          `- ${formatTicketCode(ticket.number)} · ${TICKET_STATUS_LABELS[ticket.status as TicketStatus]} · ` +
          `${ticket.subject} (actualizado ${this.shortDate(ticket.updatedAt)})`,
      )
      .join('\n');
  }

  /**
   * Articulos publicados relacionados con lo que cuenta el cliente.
   *
   * Busqueda de texto de PostgreSQL en espanol, sin acentos a ambos lados para
   * que "envia" encuentre "envía". Basta con que coincida alguna palabra: el
   * cliente no usa los mismos terminos que el articulo.
   */
  private async knowledge(messages: ChatMessage[]): Promise<string> {
    const words = [
      ...new Set(
        messages
          .filter((message) => message.direction === 'INBOUND')
          .slice(-3)
          .map((message) => message.body)
          .join(' ')
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((word) => word.length >= 4 && !STOPWORDS.has(word)),
      ),
    ].slice(0, 12);

    if (words.length === 0) return '';

    const query = words.join(' | ');

    const articles = await this.prisma.$queryRaw<
      Array<{ title: string; summary: string | null; content: string }>
    >`
      SELECT title, summary, content
      FROM (
        SELECT title, summary, content,
          ts_rank(
            to_tsvector('spanish', translate(lower(title || ' ' || coalesce(summary, '') || ' ' || content), 'áéíóúüñ', 'aeiouun')),
            to_tsquery('spanish', ${query})
          ) AS rank
        FROM articles
        WHERE is_published = true
      ) AS ranked
      WHERE rank > 0
      ORDER BY rank DESC
      LIMIT ${KNOWLEDGE_LIMIT}
    `;

    return articles
      .map(
        (article) =>
          `### ${article.title}\n${article.summary ?? ''}\n${article.content.slice(0, KNOWLEDGE_EXCERPT)}`,
      )
      .join('\n\n');
  }

  private contactLine(conversation: ConversationForReply): string {
    return conversation.client
      ? `${conversation.client.name} (+${conversation.phone}), cliente registrado`
      : `+${conversation.phone}, numero no registrado como cliente`;
  }

  private transcript(conversation: ConversationForReply, messages: ChatMessage[]): string {
    const contact = conversation.client?.name ?? 'Cliente';

    return messages
      .map((message) => {
        const speaker =
          message.direction === 'INBOUND'
            ? contact
            : message.aiGenerated
              ? 'Asistente virtual'
              : (message.author?.name ?? 'CONIT (aviso automatico)');

        return `[${this.shortDate(message.createdAt)}] ${speaker}: ${message.body.slice(0, MESSAGE_EXCERPT)}`;
      })
      .join('\n');
  }

  /* ---------------------------------------------------------------------------
   * Apoyo
   * ------------------------------------------------------------------------ */

  /** Envia lo que escribe la IA, firmado, y lo deja en la bandeja. */
  private async send(
    conversation: ConversationForReply,
    text: string,
    aiAction: 'reply' | 'troubleshoot' | 'escalate' | 'follow_up' | 'hold',
  ): Promise<void> {
    const body = `${text}${SIGNATURE}`;
    const result = await this.whatsappCloud.sendText({ to: conversation.phone, body });

    if (!result.sent) {
      this.logger.warn(
        `No se pudo enviar la respuesta automatica a ***${conversation.phone.slice(-4)}: ${
          result.reason ?? 'sin detalle'
        }`,
      );

      return;
    }

    await this.conversations.recordOutbound({
      phone: conversation.phone,
      externalId: result.id ?? null,
      type: 'text',
      body,
      aiGenerated: true,
      aiAction,
    });
  }

  private async notifyAdmins(title: string, body: string, ticketId: string | null): Promise<void> {
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
        ...(ticketId ? { ticketId } : {}),
      });
    }
  }

  /**
   * Motivo de la decision, recortado para el registro. Permite revisar por que
   * la IA contesto, diagnostico o derivo sin guardar la conversacion entera.
   */
  private brief(reasoning: string): string {
    const text = reasoning.replace(/\s+/g, ' ').trim();

    return text.length > 160 ? `${text.slice(0, 159)}…` : text;
  }

  /** Une parrafos omitiendo los vacios. */
  private joinParagraphs(...paragraphs: string[]): string {
    return paragraphs.filter((paragraph) => paragraph.trim() !== '').join('\n\n');
  }

  /** Fecha y hora de Lima, para el contexto de la IA y los mensajes. */
  private shortDate(date: Date): string {
    return new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Lima',
    }).format(date);
  }

  /** Texto dentro de los limites del ticket, o la alternativa si no llega al minimo. */
  private fit(
    value: string,
    rule: { minLength: number; maxLength: number },
    fallback: string,
  ): string {
    const text = value.trim();

    return (text.length >= rule.minLength ? text : fallback).slice(0, rule.maxLength);
  }
}
