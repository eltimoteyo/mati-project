import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/**
 * Modulo global de base de datos.
 * Al ser `@Global()`, cualquier modulo de dominio puede inyectar
 * `PrismaService` sin volver a importarlo.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
