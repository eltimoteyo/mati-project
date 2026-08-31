import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';

import { PrismaService } from '../database/prisma.service';

/**
 * Indicador de salud de PostgreSQL.
 *
 * Ejecuta una consulta trivial contra la base de datos y reporta la latencia,
 * de modo que `/health` distinga entre "la API responde" y "la API puede
 * realmente atender peticiones con datos".
 */
@Injectable()
export class PrismaHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly prisma: PrismaService,
  ) {}

  async check(key: string) {
    const indicator = this.healthIndicatorService.check(key);
    const startedAt = Date.now();

    try {
      await this.prisma.ping();

      return indicator.up({ responseTime: Date.now() - startedAt });
    } catch {
      // El motivo real queda en los logs del filtro global; hacia fuera solo
      // se expone que la dependencia no esta disponible.
      return indicator.down({
        responseTime: Date.now() - startedAt,
        message: 'No fue posible conectar con la base de datos',
      });
    }
  }
}
