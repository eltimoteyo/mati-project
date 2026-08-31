import { type AccessTokenPayload, USER_STATUSES, type UserRole } from '@conit/types';
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

/** Lee el access token exclusivamente de la cookie `httpOnly`. */
function accessTokenFromCookie(request: Request): string | null {
  const cookies = request.cookies as Record<string, string | undefined> | undefined;

  return cookies?.[COOKIE_NAMES.accessToken] ?? null;
}

/**
 * Estrategia del access token.
 *
 * Ademas de verificar la firma, vuelve a consultar el usuario en base de datos
 * para que una cuenta desactivada pierda el acceso de inmediato y no al
 * caducar el token.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, AUTH_STRATEGIES.jwt) {
  constructor(
    configService: ConfigService<AppConfig, true>,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([accessTokenFromCookie]),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt', { infer: true }).accessSecret,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.usersService.findById(payload.sub);

    if (!user || user.status !== USER_STATUSES.ACTIVE) {
      throw new UnauthorizedException(AUTH_MESSAGES.sessionInvalid);
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      sessionId: payload.sid,
    };
  }
}
