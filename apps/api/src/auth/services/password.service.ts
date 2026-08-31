import { randomBytes } from 'node:crypto';

import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Algorithm, hash, verify } from '@node-rs/argon2';

import { ARGON2_OPTIONS } from '../auth.constants';

/**
 * Hash y verificacion de contrasenas con Argon2id.
 *
 * Argon2id es la recomendacion actual de OWASP frente a bcrypt: resiste tanto
 * ataques con GPU como los basados en canal lateral.
 */
@Injectable()
export class PasswordService implements OnModuleInit {
  private readonly logger = new Logger(PasswordService.name);

  /**
   * Hash de un valor aleatorio usado para igualar tiempos cuando el correo
   * no existe. Sin esto, la diferencia de latencia entre "usuario inexistente"
   * y "contrasena incorrecta" permitiria enumerar cuentas validas.
   */
  private decoyHash = '';

  async onModuleInit(): Promise<void> {
    this.decoyHash = await this.hash(randomBytes(32).toString('hex'));
    this.logger.log('Servicio de contrasenas inicializado (Argon2id)');
  }

  /** Genera el hash Argon2id de una contrasena en claro. */
  hash(plainPassword: string): Promise<string> {
    return hash(plainPassword, {
      algorithm: Algorithm.Argon2id,
      ...ARGON2_OPTIONS,
    });
  }

  /**
   * Verifica una contrasena contra su hash.
   * Devuelve `false` ante un hash corrupto en lugar de propagar el error.
   */
  async verify(hashedPassword: string, plainPassword: string): Promise<boolean> {
    try {
      return await verify(hashedPassword, plainPassword);
    } catch {
      return false;
    }
  }

  /**
   * Consume el mismo tiempo que una verificacion real sin conceder acceso.
   * Se invoca cuando el correo no corresponde a ningun usuario.
   */
  async wasteTime(plainPassword: string): Promise<void> {
    await this.verify(this.decoyHash, plainPassword);
  }
}
