import { type ArgumentsHost, Catch, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

import { GlobalExceptionFilter } from '../../common/filters/global-exception.filter';
import type { AppConfig } from '../../config/configuration';
import { CookieService } from '../services/cookie.service';

/**
 * Limpia las cookies de sesion cuando el refresco falla.
 *
 * Sin esto se produce un bucle de redirecciones: el `proxy` de Next deja pasar
 * a `/admin` porque la cookie existe, el panel comprueba la sesion contra la
 * API, recibe 401 y vuelve a `/login`, donde el `proxy` —que sigue viendo la
 * cookie— redirige de nuevo a `/admin`.
 *
 * El servidor es quien sabe que ese refresh token ya no sirve, asi que es el
 * quien debe indicar al navegador que lo descarte. Se aplica unicamente al
 * endpoint de refresco: es el punto donde se determina de forma definitiva que
 * la sesion no es recuperable.
 */
@Injectable()
@Catch(UnauthorizedException)
export class RefreshFailureFilter extends GlobalExceptionFilter {
  constructor(
    configService: ConfigService<AppConfig, true>,
    private readonly cookieService: CookieService,
  ) {
    super(configService);
  }

  override catch(exception: unknown, host: ArgumentsHost): void {
    this.cookieService.clear(host.switchToHttp().getResponse<Response>());

    // El cuerpo de la respuesta lo genera el filtro global, para no duplicar
    // el contrato de error en dos sitios.
    super.catch(exception, host);
  }
}
