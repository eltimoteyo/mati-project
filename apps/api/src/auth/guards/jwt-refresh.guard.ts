import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { AUTH_MESSAGES, AUTH_STRATEGIES } from '../auth.constants';

/**
 * Guard del endpoint de refresco.
 * Se aplica explicitamente porque `/auth/refresh` es publico frente al
 * access token pero exige un refresh token valido.
 */
@Injectable()
export class JwtRefreshGuard extends AuthGuard(AUTH_STRATEGIES.jwtRefresh) {
  override handleRequest<TUser>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw new UnauthorizedException(AUTH_MESSAGES.sessionExpired);
    }

    return user;
  }
}
