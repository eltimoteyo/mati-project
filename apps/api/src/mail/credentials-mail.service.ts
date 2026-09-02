import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../config/configuration';
import { LOGO_CONTENT_ID, MailService, type SendEmailResult } from './mail.service';
import {
  type CredentialsEmailData,
  renderCredentialsEmail,
  renderCredentialsEmailText,
} from './templates/credentials-email.template';

export interface SendCredentialsInput {
  /** Persona a la que se dirige el correo. */
  recipientName: string;
  clientName: string;
  email: string;
  /** Contrasena en claro. Solo existe en este momento; nunca se almacena. */
  password: string;
  /** `true` cuando es un restablecimiento y no un alta. */
  isReset: boolean;
}

/**
 * Envio de credenciales del portal.
 *
 * Va en su propio servicio, separado del correo de incidencias, por una razon
 * concreta: es el unico mensaje del sistema que transporta una contrasena. Que
 * tenga su propio punto de entrada hace evidente donde ocurre eso y facilita
 * auditarlo.
 *
 * La contrasena llega como parametro y no se lee de ninguna parte: en la base
 * de datos solo hay un hash, asi que el correo unicamente puede enviarse en el
 * mismo momento en que se fija.
 */
@Injectable()
export class CredentialsMailService {
  private readonly appUrl: string;

  constructor(
    private readonly mailService: MailService,
    configService: ConfigService<AppConfig, true>,
  ) {
    this.appUrl = configService.get('mail', { infer: true }).appUrl;
  }

  async send(input: SendCredentialsInput): Promise<SendEmailResult> {
    if (!this.mailService.isEnabled()) {
      return { sent: false, reason: 'El envio de correo no esta configurado' };
    }

    const data: CredentialsEmailData = {
      recipientName: input.recipientName,
      clientName: input.clientName,
      email: input.email,
      password: input.password,
      portalUrl: `${this.appUrl.replace(/\/$/, '')}/login`,
      logoSrc: `cid:${LOGO_CONTENT_ID}`,
      isReset: input.isReset,
    };

    return this.mailService.send({
      to: input.email,
      subject: input.isReset
        ? 'Hemos restablecido tu acceso al portal de CONIT'
        : 'Tu acceso al portal de CONIT',
      html: renderCredentialsEmail(data),
      text: renderCredentialsEmailText(data),
      embedLogo: true,
    });
  }
}
