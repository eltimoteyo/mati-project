import { timingSafeEqual } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import type { Session } from '../../generated/prisma/client';

export interface SessionMetadata {
  userAgent?: string | undefined;
  ipAddress?: string | undefined;
}

/**
 * Ciclo de vida de las sesiones de refresco.
 *
 * Persistir las sesiones permite cerrar sesion de verdad (no solo borrar la
 * cookie), revocar un dispositivo concreto y detectar reutilizacion de tokens.
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Crea una sesion vacia; el hash se asigna al firmar el token. */
  create(userId: string, expiresAt: Date, metadata: SessionMetadata): Promise<Session> {
    return this.prisma.session.create({
      data: {
        userId,
        // Marcador temporal: se sustituye por el hash real en `attachToken`.
        tokenHash: ''.padEnd(64, '0'),
        expiresAt,
        userAgent: metadata.userAgent?.slice(0, 400) ?? null,
        ipAddress: metadata.ipAddress?.slice(0, 64) ?? null,
      },
    });
  }

  /** Asocia la huella del refresh token recien emitido a la sesion. */
  attachToken(sessionId: string, tokenHash: string): Promise<Session> {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: { tokenHash, lastUsedAt: new Date() },
    });
  }

  findActive(sessionId: string): Promise<Session | null> {
    return this.prisma.session.findFirst({
      where: {
        id: sessionId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  /**
   * Rota la huella tras un refresco correcto.
   * El refresh token anterior deja de ser valido de inmediato y se actualiza
   * la procedencia, util para auditar accesos en fases posteriores.
   */
  rotate(sessionId: string, tokenHash: string, metadata: SessionMetadata): Promise<Session> {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: {
        tokenHash,
        lastUsedAt: new Date(),
        userAgent: metadata.userAgent?.slice(0, 400) ?? null,
        ipAddress: metadata.ipAddress?.slice(0, 64) ?? null,
      },
    });
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revoca todas las sesiones del usuario.
   *
   * Se dispara al detectar la reutilizacion de un refresh token ya rotado
   * —sintoma tipico de un token robado— y al cambiar la contrasena.
   *
   * @param exceptSessionId Sesion que se conserva. Al cambiar la contrasena se
   * pasa la sesion actual, para no expulsar a quien acaba de hacer el cambio.
   */
  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<void> {
    const { count } = await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { NOT: { id: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    });

    this.logger.warn(`Revocadas ${count} sesiones del usuario ${userId}`);
  }

  /**
   * Compara la huella recibida con la almacenada en tiempo constante,
   * evitando filtrar informacion mediante la duracion de la comparacion.
   */
  matchesFingerprint(session: Session, fingerprint: string): boolean {
    const stored = Buffer.from(session.tokenHash, 'utf8');
    const incoming = Buffer.from(fingerprint, 'utf8');

    if (stored.length !== incoming.length) {
      return false;
    }

    return timingSafeEqual(stored, incoming);
  }
}
