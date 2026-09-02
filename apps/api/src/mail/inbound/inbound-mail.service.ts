import {
  MESSAGE_SOURCES,
  MESSAGE_VISIBILITIES,
  NOTIFICATION_TYPES,
  TICKET_EVENT_TYPES,
  TICKET_STATUS_LABELS,
  type TicketStatus,
} from '@conit/types';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import {
  cleanSubject,
  extractEmailAddress,
  extractReplyText,
  findTicketNumber,
} from './email-body';

/** Endpoint de Resend para leer el correo recibido. */
const RECEIVING_ENDPOINT = 'https://api.resend.com/emails/receiving';

/** El webhook espera respuesta; no puede quedarse colgado leyendo el cuerpo. */
const FETCH_TIMEOUT_MS = 10_000;

/** Asunto de reserva cuando el correo llega sin uno legible. */
const FALLBACK_SUBJECT = 'Incidencia recibida por correo';

/**
 * Resultado del procesamiento, para poder registrarlo y probarlo.
 *
 * Nunca es una excepcion: un correo que no se puede encaminar no es un fallo
 * del sistema, y devolver un error haria que Resend reintentase en bucle.
 */
export type InboundOutcome =
  | { action: 'ignored'; reason: string }
  | { action: 'message-added'; ticketId: string; ticketNumber: number }
  | { action: 'ticket-created'; ticketId: string; ticketNumber: number };

/** Metadatos que llegan en el webhook. */
export interface InboundWebhookData {
  email_id: string;
  from?: string;
  subject?: string | null;
}

/** Cuerpo que devuelve la API de correo recibido. */
interface ReceivedEmail {
  from?: string;
  subject?: string | null;
  text?: string | null;
  html?: string | null;
}

/**
 * Correo entrante convertido en actividad del ticket.
 *
 * Reglas, y el porque de cada una:
 *
 *  - **Solo se aceptan remitentes que son clientes registrados.** El endpoint
 *    esta abierto a internet; sin este filtro, cualquiera podria llenar el
 *    sistema de tickets escribiendo a la direccion de soporte.
 *  - **Un codigo `CNT-0042` en el asunto continua ese ticket**, pero solo si
 *    pertenece a quien escribe. De lo contrario un cliente podria colar
 *    mensajes en la incidencia de otro con solo citar su codigo.
 *  - **Un mensaje del cliente no marca la primera respuesta.** Ese indicador
 *    mide lo que tarda soporte en contestar; contarlo aqui lo falsearia.
 *  - **El mensaje entra siempre como publico.** Lo escribio el cliente, que ya
 *    lo tiene en su bandeja: ocultarlo como nota interna no tendria sentido.
 */
@Injectable()
export class InboundMailService {
  private readonly logger = new Logger(InboundMailService.name);
  private readonly config: AppConfig['mail'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    configService: ConfigService<AppConfig, true>,
  ) {
    this.config = configService.get('mail', { infer: true });
  }

  isEnabled(): boolean {
    return this.config.inbound.enabled;
  }

  get webhookSecret(): string | undefined {
    return this.config.inbound.webhookSecret;
  }

  /** Procesa un evento `email.received` ya verificado. */
  async process(data: InboundWebhookData): Promise<InboundOutcome> {
    const email = await this.fetchEmail(data.email_id);

    // Los metadatos del webhook sirven de respaldo si la lectura falla: con el
    // remitente y el asunto todavia se puede abrir un ticket, aunque sea sin
    // cuerpo, y no se pierde el aviso del cliente.
    const from = extractEmailAddress(email?.from ?? data.from);

    if (!from) {
      return { action: 'ignored', reason: 'remitente no identificable' };
    }

    const client = await this.prisma.client.findFirst({
      where: { email: { equals: from, mode: 'insensitive' } },
      select: { id: true, name: true, status: true },
    });

    if (!client) {
      this.logger.warn(`Correo descartado: ${from} no corresponde a ningun cliente`);

      return { action: 'ignored', reason: 'el remitente no es un cliente registrado' };
    }

    const subject = cleanSubject(email?.subject ?? data.subject);
    const body = extractReplyText(email?.text) ?? this.textFromHtml(email?.html);
    const number = findTicketNumber(email?.subject ?? data.subject ?? null, body);

    if (number !== null) {
      const appended = await this.appendToTicket(number, client.id, body);

      if (appended) return appended;
      // Si el ticket no existe o es de otro cliente se abre uno nuevo, en
      // lugar de perder el mensaje.
    }

    return this.createTicket(client.id, subject, body);
  }

  /* ---------------------------------------------------------------------------
   * Encaminado
   * ------------------------------------------------------------------------ */

  private async appendToTicket(
    number: number,
    clientId: string,
    body: string | null,
  ): Promise<InboundOutcome | null> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { number },
      select: { id: true, number: true, subject: true, clientId: true, status: true, assigneeId: true },
    });

    if (!ticket) return null;

    if (ticket.clientId !== clientId) {
      this.logger.warn(
        `Correo descartado: el ticket CNT-${number} no pertenece al remitente`,
      );

      return { action: 'ignored', reason: 'el ticket citado es de otro cliente' };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.message.create({
        data: {
          ticketId: ticket.id,
          authorId: null,
          body: body ?? '(el cliente respondio sin texto)',
          visibility: MESSAGE_VISIBILITIES.PUBLIC,
          source: MESSAGE_SOURCES.EMAIL,
        },
      });

      // Una respuesta del cliente sobre un ticket ya resuelto lo reabre: el
      // problema no estaba cerrado para quien lo sufre.
      if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
        await tx.ticket.update({
          where: { id: ticket.id },
          data: { status: 'IN_REVIEW', resolvedAt: null, closedAt: null },
        });

        await tx.ticketEvent.create({
          data: {
            ticketId: ticket.id,
            actorId: null,
            type: TICKET_EVENT_TYPES.STATUS_CHANGED,
            // La auditoria guarda las etiquetas visibles, igual que el panel.
            fromValue: TICKET_STATUS_LABELS[ticket.status as TicketStatus],
            toValue: TICKET_STATUS_LABELS.IN_REVIEW,
            note: 'Reabierto por una respuesta del cliente',
          },
        });
      }
    });

    await this.notifyAssignee(ticket.assigneeId, ticket.id, ticket.number, ticket.subject);

    return { action: 'message-added', ticketId: ticket.id, ticketNumber: ticket.number };
  }

  private async createTicket(
    clientId: string,
    subject: string | null,
    body: string | null,
  ): Promise<InboundOutcome> {
    const ticket = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: {
          subject: (subject ?? FALLBACK_SUBJECT).slice(0, 200),
          description: body ?? 'El cliente escribio por correo sin texto legible.',
          clientId,
          // Sin responsable ni autor: no hay nadie de soporte detras de esto.
          createdById: null,
        },
        select: { id: true, number: true },
      });

      await tx.ticketEvent.create({
        data: {
          ticketId: created.id,
          actorId: null,
          type: TICKET_EVENT_TYPES.CREATED,
          note: 'Registrado automaticamente a partir de un correo del cliente',
        },
      });

      return created;
    });

    this.logger.log(`Correo convertido en ticket CNT-${ticket.number}`);

    return { action: 'ticket-created', ticketId: ticket.id, ticketNumber: ticket.number };
  }

  /* ---------------------------------------------------------------------------
   * Apoyo
   * ------------------------------------------------------------------------ */

  /** Avisa al responsable, si lo hay. Un fallo aqui no invalida el correo. */
  private async notifyAssignee(
    assigneeId: string | null,
    ticketId: string,
    number: number,
    subject: string,
  ): Promise<void> {
    if (!assigneeId) return;

    await this.notifications.notify({
      userId: assigneeId,
      type: NOTIFICATION_TYPES.TICKET_MESSAGE,
      title: 'El cliente ha respondido por correo',
      body: NotificationsService.ticketLabel(number, subject),
      ticketId,
    });
  }

  /**
   * Lee el cuerpo del correo.
   *
   * El webhook solo trae metadatos —ni cuerpo ni cabeceras—, asi que hay que
   * pedirlo por separado. Si la lectura falla se devuelve `null` y el flujo
   * continua con lo que traia el webhook: es preferible un ticket escueto a
   * ninguno.
   */
  private async fetchEmail(emailId: string): Promise<ReceivedEmail | null> {
    if (!this.config.apiKey) return null;

    try {
      const response = await fetch(`${RECEIVING_ENDPOINT}/${emailId}`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.warn(`No se pudo leer el correo ${emailId}: HTTP ${response.status}`);

        return null;
      }

      return (await response.json()) as ReceivedEmail;
    } catch (error) {
      this.logger.warn(
        `No se pudo leer el correo ${emailId}: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );

      return null;
    }
  }

  /**
   * Texto aproximado a partir del HTML.
   *
   * Ultimo recurso para los correos que llegan solo en HTML. No pretende ser
   * un conversor: quita etiquetas, recupera los saltos de linea evidentes y
   * deja algo legible en el hilo.
   */
  private textFromHtml(html: string | null | undefined): string | null {
    if (!html) return null;

    const text = html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    return extractReplyText(text);
  }
}
