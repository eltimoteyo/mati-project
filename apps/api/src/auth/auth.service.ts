import { type PublicUser, USER_STATUSES } from '@conit/types';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';

import type { User } from '../generated/prisma/client';
import { toPublicUser } from '../users/users.mapper';
import { UsersService } from '../users/users.service';
import { AUTH_MESSAGES } from './auth.constants';
import type { LoginDto } from './dto/login.dto';
import { PasswordService } from './services/password.service';
import { type SessionMetadata, SessionService } from './services/session.service';
import { TokenService } from './services/token.service';
import type { RefreshedUser } from './strategies/jwt-refresh.strategy';

/** Tokens y datos emitidos tras un login o un refresco correcto. */
export interface IssuedSession {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  accessMaxAge: number;
  refreshMaxAge: number;
  /** Vigencia del access token en segundos, para el cliente. */
  expiresIn: number;
}

/**
 * Orquestacion de la autenticacion.
 *
 * Coordina contrasenas, tokens y sesiones sin acceder a Prisma directamente:
 * cada responsabilidad vive en su propio servicio y este las combina.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Valida credenciales y abre una sesion.
   *
   * El orden de las comprobaciones es deliberado: siempre se verifica la
   * contrasena antes de mirar el estado de la cuenta, para que un atacante no
   * pueda distinguir "cuenta inactiva" de "cuenta inexistente".
   */
  async login(dto: LoginDto, metadata: SessionMetadata): Promise<IssuedSession> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);

    if (!user) {
      // Se consume el mismo tiempo que una verificacion real (anti-enumeracion).
      await this.passwordService.wasteTime(dto.password);
      throw new UnauthorizedException(AUTH_MESSAGES.invalidCredentials);
    }

    const passwordMatches = await this.passwordService.verify(user.passwordHash, dto.password);

    if (!passwordMatches) {
      throw new UnauthorizedException(AUTH_MESSAGES.invalidCredentials);
    }

    if (user.status !== USER_STATUSES.ACTIVE) {
      throw new UnauthorizedException(AUTH_MESSAGES.inactiveAccount);
    }

    const updatedUser = await this.usersService.registerLogin(user.id);
    const ttlMs = this.tokenService.refreshTtlMs(dto.rememberMe ?? false);

    this.logger.log(`Inicio de sesion correcto: ${user.email}`);

    return this.issueSession(updatedUser, ttlMs, metadata);
  }

  /**
   * Rota la sesion a partir de un refresh token valido.
   *
   * Si la huella recibida no coincide con la almacenada, el token ya fue
   * rotado: es el patron caracteristico de un token robado y se responde
   * revocando todas las sesiones del usuario.
   */
  async refresh(refreshed: RefreshedUser, metadata: SessionMetadata): Promise<IssuedSession> {
    const session = await this.sessionService.findActive(refreshed.sessionId);

    if (!session) {
      throw new UnauthorizedException(AUTH_MESSAGES.sessionExpired);
    }

    const fingerprint = this.tokenService.fingerprint(refreshed.refreshToken);

    if (!this.sessionService.matchesFingerprint(session, fingerprint)) {
      this.logger.warn(
        `Reutilizacion de refresh token detectada (usuario ${refreshed.id}). Revocando sesiones.`,
      );
      await this.sessionService.revokeAllForUser(refreshed.id);
      throw new UnauthorizedException(AUTH_MESSAGES.sessionExpired);
    }

    const user = await this.usersService.findById(refreshed.id);

    if (!user || user.status !== USER_STATUSES.ACTIVE) {
      await this.sessionService.revoke(session.id);
      throw new UnauthorizedException(AUTH_MESSAGES.sessionInvalid);
    }

    // La sesion conserva su caducidad original: rotar el token no extiende
    // indefinidamente la vida de la sesion (limite absoluto).
    const remainingMs = session.expiresAt.getTime() - Date.now();
    const accessToken = await this.tokenService.signAccessToken(user, session.id);
    const refreshToken = await this.tokenService.signRefreshToken(user, session.id, remainingMs);

    await this.sessionService.rotate(
      session.id,
      this.tokenService.fingerprint(refreshToken),
      metadata,
    );

    return {
      user: toPublicUser(user),
      accessToken,
      refreshToken,
      accessMaxAge: this.tokenService.accessTtlSeconds * 1_000,
      refreshMaxAge: remainingMs,
      expiresIn: this.tokenService.accessTtlSeconds,
    };
  }

  /**
   * Cambia la contrasena del usuario autenticado.
   *
   * Al terminar revoca todas las demas sesiones: si la contrasena se cambia
   * porque pudo quedar comprometida, dejar vivas las sesiones abiertas en
   * otros dispositivos anularia el proposito del cambio. La sesion actual se
   * conserva para no expulsar a quien acaba de hacerlo.
   */
  async changePassword(
    userId: string,
    currentSessionId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException(AUTH_MESSAGES.sessionInvalid);
    }

    const matches = await this.passwordService.verify(user.passwordHash, currentPassword);

    if (!matches) {
      throw new UnauthorizedException('La contrasena actual no es correcta');
    }

    const passwordHash = await this.passwordService.hash(newPassword);

    await this.usersService.updatePassword(userId, passwordHash);
    await this.sessionService.revokeAllForUser(userId, currentSessionId);

    this.logger.log(`Contrasena actualizada: ${user.email}`);
  }

  /** Revoca la sesion actual. Es idempotente. */
  async logout(sessionId: string): Promise<void> {
    await this.sessionService.revoke(sessionId);
  }

  /** Crea la sesion persistida y emite el par de tokens asociado. */
  private async issueSession(
    user: User,
    refreshTtlMs: number,
    metadata: SessionMetadata,
  ): Promise<IssuedSession> {
    const expiresAt = new Date(Date.now() + refreshTtlMs);
    const session = await this.sessionService.create(user.id, expiresAt, metadata);

    const accessToken = await this.tokenService.signAccessToken(user, session.id);
    const refreshToken = await this.tokenService.signRefreshToken(user, session.id, refreshTtlMs);

    await this.sessionService.attachToken(session.id, this.tokenService.fingerprint(refreshToken));

    return {
      user: toPublicUser(user),
      accessToken,
      refreshToken,
      accessMaxAge: this.tokenService.accessTtlSeconds * 1_000,
      refreshMaxAge: refreshTtlMs,
      expiresIn: this.tokenService.accessTtlSeconds,
    };
  }
}
