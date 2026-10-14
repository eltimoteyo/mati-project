import { formatTicketCode, TICKET_STATUS_LABELS, type TicketStatus } from '@conit/types';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../config/configuration';
import { PrismaService } from '../database/prisma.service';
import { type SendWhatsappResult, WhatsappCloudService } from './whatsapp-cloud.service';
import {
  type OutboundWhatsappMessage,
  WhatsappConversationsService,
} from './whatsapp-conversations.service';

/** Digitos minimos para considerar que hay un telefono utilizable. */
const PHONE_MIN_DIGITS = 8;

/** Recorte de cada variable, para no acercarse al limite del cuerpo en Meta. */
const PARAM_MAX_LENGTH = 150;

/**
 * Avisos por WhatsApp que recibe el cliente sobre su ticket.
 *
 * Hoy es uno solo: el ticket ha llegado a un estado final. Usa la plantilla
 * configurada en `WHATSAPP_TEMPLATE_TICKET_STATUS`, que debe existir y estar
 * aprobada en Meta con tres variables en el cuerpo, en este orden:
 *
 *   {{1}} codigo del ticket      (CNT-0042)
 *   {{2}} asunto
 *   {{3}} estado al que ha pasado (Resuelto, Cerrado)
 *
 * Si Meta rechaza la plantilla, el mismo aviso sale como texto libre. Lo que
 * sale queda registrado en la conversacion de la bandeja.
 */
@Injectable()
export class TicketWhatsappService {
  private readonly logger = new Logger(TicketWhatsappService.name);
  private readonly config: AppConfig['whatsapp']['cloud'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappCloud: WhatsappCloudService,
    private readonly conversations: WhatsappConversationsService,
    configService: ConfigService<AppConfig, true>,
  ) {
    this.config = configService.get('whatsapp', { infer: true }).cloud;
  }

  /** Aviso de que el ticket ha pasado a su estado actual. */
  async sendTicketStatus(ticketId: string): Promise<SendWhatsappResult> {
    if (!this.whatsappCloud.isEnabled()) {
      return { sent: false, reason: 'El envio por WhatsApp no esta configurado' };
    }

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        number: true,
        subject: true,
        status: true,
        client: { select: { phone: true } },
      },
    });

    if (!ticket) {
      return { sent: false, reason: 'El ticket no existe' };
    }

    const code = formatTicketCode(ticket.number);
    const to = toWhatsappNumber(ticket.client.phone);

    // Un cliente sin telefono no es un error: hay fichas que solo tienen
    // correo. Se omite el envio y se dice por que.
    if (!to) {
      this.logger.log(`${code}: sin aviso por WhatsApp, el cliente no tiene telefono valido`);

      return { sent: false, reason: 'El cliente no tiene un telefono valido registrado' };
    }

    const subject = toTemplateParam(ticket.subject);
    const status = TICKET_STATUS_LABELS[ticket.status as TicketStatus] ?? ticket.status;

    // Mismo texto que la plantilla: es lo que se registra en la bandeja y lo
    // que sale si hay que recurrir al texto libre.
    const body =
      `Hola, te escribimos de CONIT Soporte. Tu solicitud ${code} (${subject}) ha pasado al ` +
      `estado: ${status}. Si el problema continúa o necesitas algo más, contáctanos y la retomamos.`;

    let type = 'template';
    let result = await this.whatsappCloud.sendTemplate({
      to,
      template: this.config.ticketStatusTemplate,
      language: this.config.templateLanguage,
      bodyParams: [code, subject, status],
    });

    if (!result.sent && isTemplateError(result.errorCode)) {
      // Sin plantilla utilizable se intenta con texto libre, que solo llega si
      // el cliente escribio en las ultimas 24 horas. Es preferible un aviso
      // que quiza no llegue a no enviar ninguno.
      this.logger.warn(`${code}: plantilla no disponible, el aviso sale como texto libre`);

      type = 'text';
      result = await this.whatsappCloud.sendText({ to, body });
    }

    if (result.sent) {
      await this.recordInInbox(code, { phone: to, externalId: result.id ?? null, type, body });
    }

    return result;
  }

  /**
   * Deja el aviso en la conversacion de la bandeja.
   *
   * Un fallo aqui no anula el aviso, que ya salio: se registra y se sigue.
   */
  private async recordInInbox(code: string, message: OutboundWhatsappMessage): Promise<void> {
    try {
      await this.conversations.recordOutbound(message);
    } catch (error) {
      this.logger.warn(
        `${code}: el aviso salio pero no se pudo registrar en la bandeja: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
    }
  }
}

/**
 * Errores de Meta propios de la plantilla (no existe, sin aprobar, pausada,
 * variables que no cuadran). Ocupan el rango 132000; el resto —credenciales,
 * destinatario no permitido— fallaria igual con texto libre.
 */
function isTemplateError(code: number | undefined): boolean {
  return code !== undefined && code >= 132_000 && code < 133_000;
}

/**
 * Numero tal como lo espera Meta: solo digitos, con codigo de pais.
 *
 * El telefono de la ficha es texto libre (`+51 987 654 321`). No se intenta
 * adivinar el codigo de pais cuando falta: un prefijo supuesto enviaria el
 * aviso a otra persona.
 */
function toWhatsappNumber(raw: string | null): string | null {
  const digits = raw?.replace(/\D/g, '') ?? '';

  return digits.length >= PHONE_MIN_DIGITS ? digits : null;
}

/**
 * Valor apto como variable de plantilla.
 *
 * Meta rechaza las variables con saltos de linea, tabuladores o mas de cuatro
 * espacios seguidos, asi que se colapsa todo el espacio en blanco.
 */
function toTemplateParam(value: string): string {
  const text = value.replace(/\s+/g, ' ').trim();

  return text.length > PARAM_MAX_LENGTH ? `${text.slice(0, PARAM_MAX_LENGTH - 1)}…` : text;
}
