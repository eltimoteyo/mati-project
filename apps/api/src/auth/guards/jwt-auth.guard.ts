import { type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { METADATA_KEYS } from '../../common/constants/app.constants';
import { AUTH_MESSAGES, AUTH_STRATEGIES } from '../auth.constants';

/**
 * Guard global de autenticacion.
 *
 * Todo endpoint requiere sesion salvo que este marcado con `@Public()`.
 * Ese "denegar por defecto" es intencional: al anadir un modulo nuevo en la
 * Fase 2, sus rutas nacen protegidas.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard(AUTH_STRATEGIES.jwt) {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(METADATA_KEYS.isPublic, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  /**
   * Homogeneiza el error: Passport distingue entre token ausente, invalido y
   * expirado, pero hacia fuera todos son el mismo 401 sin detalles.
   */
  override handleRequest<TUser>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw err instanceof Error && err instanceof UnauthorizedException
        ? err
        : new UnauthorizedException(AUTH_MESSAGES.sessionExpired);
    }

    return user;
  }
}
