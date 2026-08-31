import { type RefreshTokenPayload, USER_STATUSES, type UserRole } from '@conit/types';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { COOKIE_NAMES } from '../../common/constants/app.constants';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import type { AppConfig } from '../../config/configuration';
import { UsersService } from '../../users/users.service';
import { AUTH_MESSAGES, AUTH_STRATEGIES } from '../auth.constants';

function refreshTokenFromCookie(request: Request): string | null {
  const cookies = request.cookies as Record<string, string | undefined> | undefined;

  return cookies?.[COOKIE_NAMES.refreshToken] ?? null;
}

/** Usuario resuelto por la estrategia de refresco. */
export interface RefreshedUser extends AuthenticatedUser {
  /** Token en claro: `AuthService` lo necesita para validar la huella. */
  refreshToken: string;
}

/**
 * Estrategia del refresh token.
 *
 * Verifica firma y vigencia; la validez de la sesion persistida (revocada,
 * rotada o reutilizada) la comprueba despues `AuthService`.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, AUTH_STRATEGIES.jwtRefresh) {
  constructor(
    configService: ConfigService<AppConfig, true>,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([refreshTokenFromCookie]),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt', { infer: true }).refreshSecret,
      passReqToCallback: true,
    });
  }

  async validate(request: Request, payload: RefreshTokenPayload): Promise<RefreshedUser> {
    const refreshToken = refreshTokenFromCookie(request);

    if (!refreshToken || !payload.sid) {
      throw new UnauthorizedException(AUTH_MESSAGES.sessionExpired);
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user || user.status !== USER_STATUSES.ACTIVE) {
      throw new UnauthorizedException(AUTH_MESSAGES.sessionInvalid);
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      sessionId: payload.sid,
      refreshToken,
    };
  }
}
