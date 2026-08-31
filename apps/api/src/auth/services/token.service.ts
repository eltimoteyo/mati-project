import { createHash } from 'node:crypto';

import type { AccessTokenPayload, RefreshTokenPayload, UserRole } from '@conit/types';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type { AppConfig } from '../../config/configuration';
import type { User } from '../../generated/prisma/client';

/**
 * Emision y verificacion de tokens JWT.
 *
 * Access y refresh usan secretos distintos: si el access token se filtrase,
 * no serviria para forjar un refresh token (y viceversa).
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  private get jwtConfig() {
    return this.configService.get('jwt', { infer: true });
  }

  /** Vigencia del access token en segundos (la usa el cliente para refrescar). */
  get accessTtlSeconds(): number {
    return this.jwtConfig.accessTtlSeconds;
  }

  /** Vigencia del refresh token segun el usuario haya marcado "Recordarme". */
  refreshTtlMs(rememberMe: boolean): number {
    return rememberMe ? this.jwtConfig.refreshRememberTtlMs : this.jwtConfig.refreshTtlMs;
  }

  signAccessToken(user: Pick<User, 'id' | 'email' | 'role'>, sessionId: string): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
      sid: sessionId,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.jwtConfig.accessSecret,
      // En segundos, no en notacion abreviada: la misma cifra alimenta la
      // caducidad de la cookie, de modo que token y cookie nunca divergen.
      expiresIn: this.jwtConfig.accessTtlSeconds,
    });
  }

  /**
   * @param ttlMs Vigencia exacta del token. En el refresco se pasa el tiempo
   * restante de la sesion para que rotar el token no prolongue indefinidamente
   * su vida util (limite absoluto de sesion).
   */
  signRefreshToken(
    user: Pick<User, 'id' | 'email' | 'role'>,
    sessionId: string,
    ttlMs: number,
  ): Promise<string> {
    const payload: RefreshTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
      sid: sessionId,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.jwtConfig.refreshSecret,
      expiresIn: Math.max(1, Math.floor(ttlMs / 1_000)),
    });
  }

  /** Verifica la firma y vigencia de un refresh token. Lanza si es invalido. */
  verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    return this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
      secret: this.jwtConfig.refreshSecret,
    });
  }

  /**
   * Huella del refresh token almacenada en base de datos.
   *
   * SHA-256 basta y es la opcion correcta aqui: el token ya es un valor
   * aleatorio de alta entropia, no un secreto elegido por una persona, por
   * lo que no necesita el coste deliberado de Argon2.
   */
  fingerprint(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
