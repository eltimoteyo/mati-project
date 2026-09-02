import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../config/configuration';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/** El correo no puede bloquear la peticion que lo origino. */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Identificador del logo incrustado.
 *
 * La plantilla lo referencia como `cid:conit-logo`. Va como adjunto en linea y
 * no como enlace remoto porque un enlace exige alojar la imagen en un servidor
 * publico: en desarrollo apuntaria a `localhost` y el destinatario veria un
 * hueco roto. Incrustado, el logo se ve siempre.
 */
export const LOGO_CONTENT_ID = 'conit-logo';

/** Fichero del logo, copiado a `dist` por la configuracion de Nest. */
const LOGO_PATH = join(__dirname, 'assets', 'conit-logo.png');

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Incrusta el logo de CONIT como adjunto en linea. */
  embedLogo?: boolean;
}

export interface SendEmailResult {
  sent: boolean;
  /** Identificador que devuelve Resend, util para rastrear el envio. */
  id?: string;
  /** Motivo cuando no se envio; ya en lenguaje comprensible. */
  reason?: string;
}

/**
 * Envio de correo a traves de Resend.
 *
 * Se habla con la API REST directamente en lugar de anadir el SDK: la
 * operacion es un unico POST, y una dependencia menos es una superficie menos
 * que mantener y auditar.
 *
 * Ningun fallo de correo interrumpe la operacion que lo provoco. Un ticket
 * debe poder crearse aunque el proveedor de correo este caido; el envio se
 * registra como fallido y se sigue.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly config: AppConfig['mail'];

  /**
   * Logo en base64, leido una sola vez.
   *
   * Se cachea en memoria porque el fichero no cambia mientras el proceso vive
   * y releerlo en cada correo seria una lectura de disco por envio.
   */
  private readonly logoBase64: string | null;

  constructor(configService: ConfigService<AppConfig, true>) {
    this.config = configService.get('mail', { infer: true });
    this.logoBase64 = this.loadLogo();

    if (!this.config.enabled) {
      this.logger.warn('Envio de correo desactivado: no se enviaran notificaciones por correo');
    }
  }

  /** Si el fichero falta, el correo sale sin imagen en lugar de no salir. */
  private loadLogo(): string | null {
    try {
      return readFileSync(LOGO_PATH).toString('base64');
    } catch {
      this.logger.warn(
        `No se encontro el logo en ${LOGO_PATH}; los correos usaran el nombre en texto`,
      );

      return null;
    }
  }

  /** Indica si el logo puede incrustarse; la plantilla decide que pintar. */
  get canEmbedLogo(): boolean {
    return this.logoBase64 !== null;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  get logoUrl(): string | undefined {
    return this.config.logoUrl;
  }

  get appUrl(): string {
    return this.config.appUrl;
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    if (!this.config.enabled || !this.config.apiKey) {
      return { sent: false, reason: 'El envio de correo no esta configurado' };
    }

    try {
      const response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.config.from,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
          ...(this.config.replyTo ? { reply_to: this.config.replyTo } : {}),
          ...(input.embedLogo && this.logoBase64
            ? {
                attachments: [
                  {
                    filename: 'conit-logo.png',
                    content: this.logoBase64,
                    content_type: 'image/png',
                    // `content_id` es lo que convierte el adjunto en una imagen
                    // en linea: sin el, aparece como fichero descargable.
                    content_id: LOGO_CONTENT_ID,
                  },
                ],
              }
            : {}),
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      const payload = (await response.json().catch(() => null)) as {
        id?: string;
        message?: string;
        name?: string;
      } | null;

      if (!response.ok) {
        // El mensaje del proveedor se registra para poder diagnosticar (dominio
        // sin verificar, destinatario no permitido en modo prueba...), pero la
        // clave nunca aparece en el registro.
        const reason = payload?.message ?? `HTTP ${response.status}`;

        this.logger.warn(`Resend rechazo el envio a ${this.mask(input.to)}: ${reason}`);

        return { sent: false, reason };
      }

      this.logger.log(`Correo enviado a ${this.mask(input.to)} (${payload?.id ?? 'sin id'})`);

      return { sent: true, ...(payload?.id ? { id: payload.id } : {}) };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'error desconocido';

      this.logger.warn(`No se pudo contactar con Resend: ${reason}`);

      return { sent: false, reason };
    }
  }

  /**
   * Oculta el buzon en los registros.
   *
   * Un fichero de log no deberia servir para recolectar direcciones de los
   * clientes; el dominio basta para diagnosticar problemas de entrega.
   */
  private mask(email: string): string {
    const [user, domain] = email.split('@');

    if (!user || !domain) return '***';

    return `${user.slice(0, 2)}***@${domain}`;
  }
}
