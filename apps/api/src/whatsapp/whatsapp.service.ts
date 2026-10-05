import {
  formatTicketCode,
  MESSAGE_SOURCES,
  MESSAGE_VISIBILITIES,
  NOTIFICATION_TYPES,
  TICKET_EVENT_TYPES,
} from '@conit/types';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AiService } from '../ai/ai.service';
import type { AppConfig } from '../config/configuration';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Limite de caracteres para el asunto derivado del primer mensaje. */
const SUBJECT_MAX_LENGTH = 200;

/** Longitud del texto que queda como asunto provisional. */
const SUBJECT_PREVIEW_LENGTH = 60;

/** Timeout por peticion a la API de Twilio. */
const TWILIO_FETCH_TIMEOUT_MS = 10_000;

/** Endpoint de envio de mensajes de Twilio. */
const TWILIO_MESSAGES_URL = 'https://api.twilio.com/2010-04-01/Accounts';

/** Datos que llegan en el webhook de WhatsApp via Twilio. */
export interface WhatsappWebhookData {
  /** Numero del remitente con prefijo `whatsapp:+...`. */
  from: string;
  /** Cuerpo del mensaje. */
  body: string;
  /** ID de WhatsApp (numero sin +, sin prefijo). */
  waId?: string;
  /** Nombre publico del perfil de WhatsApp del remitente. */
  profileName?: string;
  /** ID unico del mensaje que Twilio genera. */
  messageSid: string;
  /** Numero de WhatsApp de CONIT que recibio el mensaje. */
  to?: string;
  /** Marca de tiempo Unix del mensaje. */
  timestamp?: string;
}

/** Resultado del procesamiento de un mensaje de WhatsApp. */
export type WhatsappOutcome =
  | { action: 'ignored'; reason: string }
  | { action: 'message-added'; ticketId: string; ticketCode: string }
  | { action: 'ticket-created'; ticketId: string; ticketCode: string; replySent: boolean };

/**
 * Integracion de WhatsApp (Twilio).
 *
 * Flujo:
 *  1. El cliente escribe por WhatsApp → Twilio envia un webhook a nuestro
 *     endpoint publico.
 *  2. Se normaliza el numero del remitente y se busca el cliente registrado.
 *  3. Si hay un ticket abierto, se agrega el mensaje a la conversacion; si no,
 *     se crea uno nuevo con el mensaje como descripcion.
 *  4. Se genera una respuesta de IA con `AiService.generatePortalReply`.
 *  5. La respuesta se guarda en el ticket (fuente WHATSAPP) y se envia de
 *     vuelta al cliente por la API de Twilio.
 *
 * El endpoint esta protegido por verificacion de firma de Twilio: sin la
 * clave configurada se rechaza todo. Un mensaje que no se puede encaminar
 * no es un fallo del servidor, asi que el webhook siempre responde 200.
 */
@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly config: AppConfig['whatsapp'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly aiService: AiService,
    configService: ConfigService<AppConfig, true>,
  ) {
    this.config = configService.get('whatsapp', { infer: true });
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  /** Token de autenticacion de Twilio, para verificacion de firmas. */
  get authToken(): string | undefined {
    return this.config.authToken;
  }

  /** Procesa un webhook de WhatsApp ya verificado. */
  async process(data: WhatsappWebhookData): Promise<WhatsappOutcome> {
    const phone = normalizePhone(data.from);

    if (!phone) {
      return { action: 'ignored', reason: 'numero de origen no identificable' };
    }

    // El telefono en la BD puede estar formateado (+51 987 654 321) mientras
    // que `phone` ya esta normalizado a digitos (51987654321). Se usa una query
    // raw para normalizar el campo almacenado y comparar solo digitos.
    const clients = await this.prisma.$queryRaw<
      Array<{ id: string; name: string; status: string }>
    >`
      SELECT id, name, status
      FROM "clients"
      WHERE REGEXP_REPLACE("phone", '[^0-9]', '', 'g') = ${phone}
        AND "status" = 'ACTIVE'
      LIMIT 1
    `;

    const client = clients[0];

    if (!client) {
      this.logger.warn(`WhatsApp de ${phone} ignorado: no es un cliente registrado`);

      return { action: 'ignored', reason: 'el remitente no es un cliente registrado' };
    }

    // Buscar un ticket abierto para este cliente.
    const openTicket = await this.findOpenTicket(client.id);

    if (openTicket) {
      return this.appendMessage(openTicket, client, data);
    }

    return this.createTicket(client, data);
  }

  /* ---------------------------------------------------------------------------
   * Envio
   * ------------------------------------------------------------------------ */

  /**
   * Envia un mensaje de texto a un numero de WhatsApp via Twilio.
   * Nunca lanza: un fallo de envio se registra y se devuelve `false`.
   */
  async sendMessage(to: string, body: string): Promise<boolean> {
    if (!this.config.enabled || !this.config.accountSid || !this.config.authToken) {
      this.logger.warn('Envio de WhatsApp no configurado');

      return false;
    }

    const params = new URLSearchParams({
      From: this.config.fromNumber ?? '',
      To: to,
      Body: body,
    });

    try {
      const response = await fetch(
        `${TWILIO_MESSAGES_URL}/${this.config.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${this.config.accountSid}:${this.config.authToken}`,
            ).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
          signal: AbortSignal.timeout(TWILIO_FETCH_TIMEOUT_MS),
        },
      );

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        this.logger.warn(`Error enviando WhatsApp: HTTP ${response.status} ${detail}`);

        return false;
      }

      return true;
    } catch (error) {
      this.logger.warn(
        `Error enviando WhatsApp: ${error instanceof Error ? error.message : 'error desconocido'}`,
      );

      return false;
    }
  }

  /* ---------------------------------------------------------------------------
   * Encaminado
   * ------------------------------------------------------------------------ */

  /**
   * Busca un ticket abierto (NEW, IN_REVIEW o IN_PROGRESS) para el cliente.
   * Se queda con el mas reciente: es el canal de conversacion activa.
   */
  private async findOpenTicket(clientId: string) {
    return this.prisma.ticket.findFirst({
      where: { clientId, status: { in: ['NEW', 'IN_REVIEW', 'IN_PROGRESS'] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, number: true, subject: true, description: true },
    });
  }

  /**
   * Agrega el mensaje del cliente a un ticket existente y genera una respuesta
   * de IA que se envia de vuelta por WhatsApp.
   */
  private async appendMessage(
    ticket: { id: string; number: number; subject: string; description: string },
    client: { id: string; name: string },
    data: WhatsappWebhookData,
  ): Promise<WhatsappOutcome> {
    const subject = cleanSubject(ticket.subject);

    // Guardamos el mensaje del cliente como parte del hilo.
    const conversation = await this.prisma.$transaction(async (tx) => {
      await tx.message.create({
        data: {
          ticketId: ticket.id,
          authorId: null,
          body: data.body,
          visibility: MESSAGE_VISIBILITIES.PUBLIC,
          source: MESSAGE_SOURCES.WHATSAPP,
        },
      });

      // Un mensaje del cliente sobre un ticket resuelto o cerrado lo reabre.
      const existing = await tx.ticket.findUnique({
        where: { id: ticket.id },
        select: { status: true, assigneeId: true },
      });

      if (existing?.status === 'RESOLVED' || existing?.status === 'CLOSED') {
        await tx.ticket.update({
          where: { id: ticket.id },
          data: { status: 'IN_REVIEW', resolvedAt: null, closedAt: null },
        });

        await tx.ticketEvent.create({
          data: {
            ticketId: ticket.id,
            actorId: null,
            type: TICKET_EVENT_TYPES.STATUS_CHANGED,
            fromValue: existing.status,
            toValue: 'IN_REVIEW',
            note: 'Reabierto por un mensaje de WhatsApp',
          },
        });
      }

      // Cargamos el historial para pasarlo de contexto a la IA.
      const messages = await tx.message.findMany({
        where: { ticketId: ticket.id },
        orderBy: { createdAt: 'asc' },
        select: { body: true, visibility: true, createdAt: true },
      });

      return messages.map((m) => m.body).join('\n\n');
    });

    const reply = await this.aiService.generatePortalReply(subject, data.body, conversation);

    await this.prisma.$transaction(async (tx) => {
      // Guardamos la respuesta de IA como un mensaje del sistema en el ticket.
      await tx.message.create({
        data: {
          ticketId: ticket.id,
          authorId: null,
          body: reply,
          visibility: MESSAGE_VISIBILITIES.PUBLIC,
          source: MESSAGE_SOURCES.WHATSAPP,
        },
      });
    });

    await this.sendAndNotify(client, ticket, reply, data.from);

    return {
      action: 'message-added',
      ticketId: ticket.id,
      ticketCode: formatTicketCode(ticket.number),
    };
  }

  /**
   * Crea un ticket nuevo con el primer mensaje del cliente, genera una
   * respuesta de IA y la envia por WhatsApp.
   */
  private async createTicket(
    client: { id: string; name: string },
    data: WhatsappWebhookData,
  ): Promise<WhatsappOutcome> {
    const subject = data.body.length > SUBJECT_PREVIEW_LENGTH
      ? `${data.body.slice(0, SUBJECT_PREVIEW_LENGTH)}…`
      : data.body;

    const ticket = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: {
          subject,
          description: data.body,
          clientId: client.id,
          createdById: null,
        },
        select: { id: true, number: true, subject: true },
      });

      await tx.ticketEvent.create({
        data: {
          ticketId: created.id,
          actorId: null,
          type: TICKET_EVENT_TYPES.CREATED,
          note: 'Registrado automaticamente a partir de un mensaje de WhatsApp',
        },
      });

      await tx.message.create({
        data: {
          ticketId: created.id,
          authorId: null,
          body: data.body,
          visibility: MESSAGE_VISIBILITIES.PUBLIC,
          source: MESSAGE_SOURCES.WHATSAPP,
        },
      });

      return created;
    });

    const reply = await this.aiService.generatePortalReply(subject, data.body);

    await this.prisma.$transaction(async (tx) => {
      await tx.message.create({
        data: {
          ticketId: ticket.id,
          authorId: null,
          body: reply,
          visibility: MESSAGE_VISIBILITIES.PUBLIC,
          source: MESSAGE_SOURCES.WHATSAPP,
        },
      });
    });

    const replySent = await this.sendAndNotify(client, ticket, reply, data.from);

    return {
      action: 'ticket-created',
      ticketId: ticket.id,
      ticketCode: formatTicketCode(ticket.number),
      replySent,
    };
  }

  /* ---------------------------------------------------------------------------
   * Apoyo
   * ------------------------------------------------------------------------ */

  /** Envio la respuesta de IA por WhatsApp y avisa al equipo si hace falta. */
  private async sendAndNotify(
    client: { id: string; name: string },
    ticket: { id: string; number: number; subject: string },
    reply: string,
    senderPhone: string,
  ): Promise<boolean> {
    // Enviamos la respuesta al cliente por WhatsApp.
    const sent = await this.sendMessage(senderPhone, reply);

    if (sent) {
      this.logger.log(`Respuesta de WhatsApp enviada a ${client.name} (CNT-${ticket.number})`);
    } else {
      this.logger.warn(`No se pudo enviar la respuesta de WhatsApp a ${client.name}`);
    }

    // Notificamos al responsable del ticket, si lo hay.
    const fullTicket = await this.prisma.ticket.findUnique({
      where: { id: ticket.id },
      select: { assigneeId: true },
    });

    if (fullTicket?.assigneeId) {
      await this.notifications.notify({
        userId: fullTicket.assigneeId,
        type: NOTIFICATION_TYPES.TICKET_MESSAGE,
        title: 'Nuevo mensaje de WhatsApp',
        body: NotificationsService.ticketLabel(ticket.number, ticket.subject),
        ticketId: ticket.id,
      });
    }

    return sent;
  }
}

/* ---------------------------------------------------------------------------
 * Utilidades de normalizacion
 * --------------------------------------------------------------------------- */

/**
 * Normaliza un numero de WhatsApp a digitos sin el signo `+`.
 *
 * Twilio envia `From` como `whatsapp:+519876543210`; el cliente puede tener el
 * telefono guardado como `+51 987 654 321`. Ambas deben colisionar.
 */
function normalizePhone(raw: string | undefined): string | null {
  if (!raw) return null;

  const withDigits = raw.replace(/\D/g, '');

  return withDigits.length >= 6 ? withDigits : null;
}

/**
 * Limpia el asunto: quita prefijos de respuesta y espacios sobrantes.
 * Deriva del primer mensaje del cliente, por lo que puede incluir texto
 * citado que no nos interesa.
 */
function cleanSubject(subject: string): string {
  return subject
    .replace(/^(?:re|rv|fwd|fw)\s*:?\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SUBJECT_MAX_LENGTH);
}
