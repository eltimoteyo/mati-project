import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';

import { COOKIE_NAMES } from '../../common/constants/app.constants';
import type { AppConfig } from '../../config/configuration';

/**
 * Emision de las cookies de sesion.
 *
 * Los tokens viajan exclusivamente en cookies `httpOnly`: JavaScript del
 * navegador no puede leerlos, lo que neutraliza el robo de sesion por XSS.
 * Centralizar aqui las opciones evita que un endpoint emita una cookie con
 * atributos de seguridad distintos por descuido.
 */
@Injectable()
export class CookieService {
  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  private baseOptions(maxAge: number): CookieOptions {
    const cookies = this.configService.get('cookies', { infer: true });

    return {
      httpOnly: true,
      secure: cookies.secure,
      sameSite: cookies.sameSite,
      path: '/',
      maxAge,
      ...(cookies.domain ? { domain: cookies.domain } : {}),
    };
  }

  setAccessToken(response: Response, token: string, maxAge: number): void {
    response.cookie(COOKIE_NAMES.accessToken, token, this.baseOptions(maxAge));
  }

  setRefreshToken(response: Response, token: string, maxAge: number): void {
    response.cookie(COOKIE_NAMES.refreshToken, token, this.baseOptions(maxAge));
  }

  /** Elimina ambas cookies. Los atributos deben coincidir con los de emision. */
  clear(response: Response): void {
    const options = this.baseOptions(0);
    delete options.maxAge;

    response.clearCookie(COOKIE_NAMES.accessToken, options);
    response.clearCookie(COOKIE_NAMES.refreshToken, options);
  }
}
