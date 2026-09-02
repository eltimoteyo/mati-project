import {
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

import { Public } from '../../common/decorators/public.decorator';
import { RawResponse } from '../../common/decorators/response.decorator';
import { InboundMailService, type InboundWebhookData } from './inbound-mail.service';
import { verifySvixSignature } from './webhook-signature';

/** Evento de Resend que interesa; el resto se acepta y se ignora. */
const RECEIVED_EVENT = 'email.received';

/** Cuerpo del webhook, antes de validar. */
interface WebhookBody {
  type?: string;
  data?: Partial<InboundWebhookData>;
}

/**
 * Recepcion de correo entrante.
 *
 * Es el unico endpoint publico que escribe en la base de datos, asi que la
 * firma es la barrera que lo sostiene: sin secreto configurado se rechaza todo,
 * y con el, solo pasa lo que Resend haya firmado.
 *
 * Salvo la firma invalida, **siempre responde 200**. Un correo que no se puede
 * encaminar no es un fallo del servidor, y devolver un error solo conseguiria
 * que Resend lo reintentase indefinidamente.
 *
 * Queda fuera de Swagger: no es una API para terceros, y publicar su forma
 * solo ayudaria a quien quisiera sondearla.
 */
@ApiExcludeController()
@Controller('mail/inbound')
export class InboundMailController {
  private readonly logger = new Logger(InboundMailController.name);

  constructor(private readonly inboundMail: InboundMailService) {}

  @Post()
  @Public()
  @RawResponse()
  @HttpCode(HttpStatus.OK)
  // Limite propio y holgado: alto para no perder una rafaga legitima de
  // correo, acotado para que el endpoint no sirva de ariete.
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  async receive(
    @Req() request: RawBodyRequest<Request>,
    @Headers('svix-id') svixId?: string,
    @Headers('svix-timestamp') svixTimestamp?: string,
    @Headers('svix-signature') svixSignature?: string,
  ): Promise<{ received: true }> {
    const secret = this.inboundMail.webhookSecret;

    if (!secret) {
      this.logger.warn('Webhook de correo recibido sin RESEND_WEBHOOK_SECRET configurado');

      throw new UnauthorizedException('Firma no verificable');
    }

    // El cuerpo debe ir sin parsear: volver a serializarlo cambiaria un
    // espacio y la firma dejaria de cuadrar.
    const rawBody = request.rawBody?.toString('utf8');

    if (!rawBody) {
      throw new UnauthorizedException('Firma no verificable');
    }

    const result = verifySvixSignature(
      rawBody,
      { id: svixId, timestamp: svixTimestamp, signature: svixSignature },
      secret,
    );

    if (!result.valid) {
      this.logger.warn(`Webhook de correo rechazado: ${result.reason}`);

      // Mensaje generico: detallar que fallo ayudaria a afinar un intento.
      throw new UnauthorizedException('Firma invalida');
    }

    const body = request.body as WebhookBody;

    if (body?.type !== RECEIVED_EVENT) {
      return { received: true };
    }

    const emailId = body.data?.email_id;

    if (!emailId) {
      this.logger.warn('Evento email.received sin email_id');

      return { received: true };
    }

    const outcome = await this.inboundMail.process({
      email_id: emailId,
      ...(body.data?.from ? { from: body.data.from } : {}),
      ...(body.data?.subject ? { subject: body.data.subject } : {}),
    });

    if (outcome.action === 'ignored') {
      this.logger.log(`Correo entrante ignorado: ${outcome.reason}`);
    }

    return { received: true };
  }
}
