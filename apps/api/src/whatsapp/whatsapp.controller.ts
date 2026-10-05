import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  type RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { Public } from '../common/decorators/public.decorator';
import { RawResponse } from '../common/decorators/response.decorator';
import { WhatsappService, type WhatsappWebhookData } from './whatsapp.service';
import { verifyTwilioSignature } from './whatsapp-signature';

/**
 * Recepcion de mensajes de WhatsApp via Twilio.
 *
 * Es el unico endpoint publico que escribe en la base de datos, asi que la
 * firma de Twilio es la barrera que lo sostiene: sin token configurado se
 * rechaza todo, y con el, solo pasa lo que Twilio haya firmado.
 *
 * Salvo la firma invalida, **siempre responde 200**. Un mensaje que no se
 * puede encaminar no es un fallo del servidor, y devolver un error solo
 * provocaria que Twilio lo reintentase indefinidamente.
 *
 * Queda fuera de Swagger: no es una API para terceros, y publicar su forma
 * solo ayudaria a quien quisiera sondearla.
 */
@ApiExcludeController()
@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(private readonly whatsapp: WhatsappService) {}

  @Post('webhook')
  @Public()
  @RawResponse()
  @HttpCode(HttpStatus.OK)
  // Limite propio y holgado: alto para no perder una rafaga legitima, acotado
  // para que el endpoint no sirva de ariete.
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  async receive(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-twilio-signature') signature?: string,
    @Body() body?: Record<string, string>,
  ): Promise<{ received: true }> {
    const authToken = this.whatsapp.authToken;

    if (!this.whatsapp.isEnabled() || !authToken) {
      this.logger.warn('Webhook de WhatsApp recibido sin TWILIO_AUTH_TOKEN configurado');

      throw new UnauthorizedException('WhatsApp no esta configurado');
    }

    // El cuerpo debe ir sin parsear: volver a serializarlo cambiaria un
    // espacio y la firma dejaria de cuadrar.
    const rawBody = request.rawBody?.toString('utf8');

    if (!rawBody) {
      throw new UnauthorizedException('Firma no verificable');
    }

    const result = verifyTwilioSignature(
      this.requestUrl(request),
      body ?? {},
      signature,
      authToken,
    );

    if (!result.valid) {
      this.logger.warn(`Webhook de WhatsApp rechazado: ${result.reason}`);

      // Mensaje generico: detallar que fallo ayudaria a afinar un intento.
      throw new UnauthorizedException('Firma invalida');
    }

    const data: WhatsappWebhookData = {
      from: body?.From ?? '',
      body: body?.Body ?? '',
      waId: body?.WaId,
      profileName: body?.ProfileName,
      messageSid: body?.SmsMessageSid ?? '',
      to: body?.To,
      timestamp: body?.Timestamp,
    };

    if (!data.from || !data.body) {
      this.logger.warn('Webhook de WhatsApp sin From o Body');

      return { received: true };
    }

    const outcome = await this.whatsapp.process(data);

    if (outcome.action === 'ignored') {
      this.logger.log(`WhatsApp ignorado: ${outcome.reason}`);
    } else if (outcome.action === 'ticket-created') {
      this.logger.log(
        `WhatsApp creo ticket ${outcome.ticketCode} (replySent: ${outcome.replySent})`,
      );
    } else {
      this.logger.log(`WhatsApp agrego mensaje a ticket ${outcome.ticketCode}`);
    }

    return { received: true };
  }

  /**
   * URL completa del webhook tal como la llamo Twilio.
   *
   * Twilio firma con el URL tal como se recibe, asi que hay que reconstruirlo
   * exactamente igual que lo vio Twilio. `req.url` en Express puede contener
   * query params o estar montado bajo un prefijo, asi que lo reconstruimos desde
   * host y path.
   *
   * Detras de un proxy inverso (nginx, Cloudflare Tunnel, ngrok) el host y el
   * protocolo publicos no estan en `req.headers.host`: llegan en
   * `x-forwarded-host` y `x-forwarded-proto`, y son esos los que hay que
   *_prefijar. Si se usara el host interno, la firma no cuadraria nunca.
   */
  private requestUrl(request: Request): string {
    const forwardedHost = request.headers['x-forwarded-host'];

    // Tras varios saltos, `x-forwarded-host` puede traer una cadena de proxies
    // separada por comas; el primero es el host que el cliente pidio.
    const host =
      (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost?.split(',')[0])?.trim() ||
      request.headers.host ||
      'localhost:4000';

    const forwardedProto = request.headers['x-forwarded-proto'];
    const protocol =
      (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto?.split(',')[0])?.trim() ||
      'https';

    return `${protocol}://${host}${request.url}`;
  }
}
