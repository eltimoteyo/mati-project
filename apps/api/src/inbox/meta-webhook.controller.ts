import { timingSafeEqual } from 'node:crypto';

import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  type RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { Public } from '../common/decorators/public.decorator';
import { RawResponse } from '../common/decorators/response.decorator';
import { InboxService } from './inbox.service';
import { parseMetaWebhook, verifyMetaSignature } from './meta-webhook';

/**
 * Webhook de WhatsApp de Meta.
 *
 * `GET` es la verificacion que hace Meta al registrar la URL: devuelve el
 * `hub.challenge` solo si el token coincide. `POST` trae los mensajes y los
 * avisos de entrega, firmados con la clave secreta de la app; esa firma es la
 * unica barrera de un endpoint abierto a internet, asi que sin clave
 * configurada se rechaza todo.
 *
 * Salvo la firma invalida, el `POST` **siempre responde 200**: un evento que
 * no interesa no es un fallo, y devolver un error solo haria que Meta lo
 * reintentase durante dias.
 *
 * Queda fuera de Swagger: no es una API para terceros.
 */
@ApiExcludeController()
@Controller('whatsapp/meta/webhook')
export class MetaWebhookController {
  private readonly logger = new Logger(MetaWebhookController.name);

  constructor(private readonly inbox: InboxService) {}

  @Get()
  @Public()
  @RawResponse()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  verify(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ): string {
    const expected = this.inbox.verifyToken;

    if (!expected) {
      this.logger.warn('Verificacion de webhook sin WHATSAPP_VERIFY_TOKEN ni WHATSAPP_APP_SECRET');

      throw new ForbiddenException('El webhook de WhatsApp no esta configurado');
    }

    if (mode !== 'subscribe' || !challenge || !token || !sameText(token, expected)) {
      this.logger.warn('Verificacion de webhook rechazada: el token no coincide');

      throw new ForbiddenException('Token de verificacion invalido');
    }

    this.logger.log('Webhook de WhatsApp verificado por Meta');

    return challenge;
  }

  @Post()
  @Public()
  @RawResponse()
  @HttpCode(HttpStatus.OK)
  // Holgado: Meta agrupa los avisos de entrega y puede enviar rafagas.
  @Throttle({ default: { ttl: 60_000, limit: 600 } })
  async receive(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature?: string,
  ): Promise<{ received: true }> {
    const appSecret = this.inbox.appSecret;

    if (!appSecret) {
      this.logger.warn('Webhook de WhatsApp recibido sin WHATSAPP_APP_SECRET configurado');

      throw new UnauthorizedException('Firma no verificable');
    }

    if (!request.rawBody) {
      throw new UnauthorizedException('Firma no verificable');
    }

    const result = verifyMetaSignature(request.rawBody, signature, appSecret);

    if (!result.valid) {
      this.logger.warn(`Webhook de WhatsApp rechazado: ${result.reason}`);

      // Mensaje generico: detallar que fallo ayudaria a afinar un intento.
      throw new UnauthorizedException('Firma invalida');
    }

    await this.inbox.receive(parseMetaWebhook(request.body, this.inbox.phoneNumberId));

    return { received: true };
  }
}

/** Comparacion en tiempo constante, para no filtrar el token por la duracion. */
function sameText(received: string, expected: string): boolean {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b);
}
