import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../config/configuration';

const GRAPH_API_URL = 'https://graph.facebook.com';

/** El aviso no puede bloquear la peticion que lo origino. */
const REQUEST_TIMEOUT_MS = 10_000;

export interface SendTemplateInput {
  /** Numero del destinatario con codigo de pais, solo digitos. */
  to: string;
  /** Nombre de la plantilla tal como figura aprobada en Meta. */
  template: string;
  /** Codigo de idioma de la plantilla (`es`, `en_US`...). */
  language: string;
  /** Valores de las variables `{{1}}`, `{{2}}`... del cuerpo, en orden. */
  bodyParams?: string[];
}

export interface SendTextInput {
  /** Numero del destinatario con codigo de pais, solo digitos. */
  to: string;
  body: string;
}

export interface SendWhatsappResult {
  sent: boolean;
  /** Identificador que devuelve Meta, util para rastrear el envio. */
  id?: string;
  /** Motivo cuando no se envio; ya en lenguaje comprensible. */
  reason?: string;
  /** Codigo de error de Meta, cuando el rechazo vino de su API. */
  errorCode?: number;
}

/** Forma de la respuesta de Meta que realmente se consume. */
interface GraphResponse {
  messages?: Array<{ id?: string }>;
  error?: { message?: string; code?: number; error_data?: { details?: string } };
}

/**
 * Envio de WhatsApp a traves de la Cloud API de Meta.
 *
 * Hay dos formas de escribir a un cliente, y no son intercambiables:
 *
 *  - **Plantilla.** Llega siempre. Es la unica via para un aviso que inicia la
 *    empresa, y Meta la rechaza en el acto si no existe o no esta aprobada.
 *  - **Texto libre.** Solo llega dentro de las 24 horas siguientes al ultimo
 *    mensaje del cliente. Fuera de esa ventana Meta lo acepta igualmente y lo
 *    descarta despues, de modo que aqui no llega a saberse.
 *
 * Ningun fallo de envio interrumpe la operacion que lo provoco: se registra y
 * se devuelve el motivo, igual que el correo.
 */
@Injectable()
export class WhatsappCloudService {
  private readonly logger = new Logger(WhatsappCloudService.name);
  private readonly config: AppConfig['whatsapp']['cloud'];

  constructor(configService: ConfigService<AppConfig, true>) {
    this.config = configService.get('whatsapp', { infer: true }).cloud;

    if (!this.config.enabled) {
      this.logger.warn('WhatsApp (Meta) desactivado: no se enviaran avisos por WhatsApp');
    }
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  sendTemplate(input: SendTemplateInput): Promise<SendWhatsappResult> {
    const bodyParams = input.bodyParams ?? [];

    return this.post(input.to, {
      type: 'template',
      template: {
        name: input.template,
        language: { code: input.language },
        ...(bodyParams.length > 0
          ? {
              components: [
                {
                  type: 'body',
                  parameters: bodyParams.map((text) => ({ type: 'text', text })),
                },
              ],
            }
          : {}),
      },
    });
  }

  sendText(input: SendTextInput): Promise<SendWhatsappResult> {
    return this.post(input.to, { type: 'text', text: { body: input.body } });
  }

  private async post(to: string, message: Record<string, unknown>): Promise<SendWhatsappResult> {
    if (!this.config.enabled || !this.config.accessToken || !this.config.phoneNumberId) {
      return { sent: false, reason: 'El envio por WhatsApp no esta configurado' };
    }

    try {
      const response = await fetch(
        `${GRAPH_API_URL}/${this.config.graphVersion}/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messaging_product: 'whatsapp', to, ...message }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );

      const payload = (await response.json().catch(() => null)) as GraphResponse | null;

      if (!response.ok) {
        // El detalle de Meta se registra para poder diagnosticar (plantilla sin
        // aprobar, destinatario fuera de la lista de prueba...), pero el token
        // nunca aparece en el registro.
        const reason = this.describeError(payload, response.status);
        const errorCode = payload?.error?.code;

        this.logger.warn(`Meta rechazo el WhatsApp a ${this.mask(to)}: ${reason}`);

        return { sent: false, reason, ...(errorCode ? { errorCode } : {}) };
      }

      const id = payload?.messages?.[0]?.id;

      this.logger.log(
        `WhatsApp (${String(message['type'])}) aceptado por Meta para ${this.mask(to)} (${id ?? 'sin id'})`,
      );

      return { sent: true, ...(id ? { id } : {}) };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'error desconocido';

      this.logger.warn(`No se pudo contactar con Meta: ${reason}`);

      return { sent: false, reason };
    }
  }

  private describeError(payload: GraphResponse | null, status: number): string {
    const error = payload?.error;

    if (!error) return `HTTP ${status}`;

    const detail = error.error_data?.details ?? error.message ?? 'sin detalle';

    return error.code ? `${detail} (codigo ${error.code})` : detail;
  }

  /**
   * Oculta el numero en los registros.
   *
   * Un fichero de log no deberia servir para recolectar telefonos de los
   * clientes; el final del numero basta para diagnosticar un envio.
   */
  private mask(phone: string): string {
    return phone.length > 4 ? `***${phone.slice(-4)}` : '***';
  }
}
