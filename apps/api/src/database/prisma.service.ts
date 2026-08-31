import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

import type { AppConfig } from '../config/configuration';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Cliente Prisma gestionado por el ciclo de vida de Nest.
 *
 * Es el unico punto de acceso a PostgreSQL: los servicios de dominio lo
 * inyectan y ningun modulo instancia su propio `PrismaClient`.
 *
 * Desde Prisma 7 la conexion se establece mediante un adaptador de driver
 * (`PrismaPg` sobre `pg`), lo que elimina el motor nativo en Rust y permite
 * que la cadena de conexion provenga de la configuracion validada en lugar
 * de leerse de `process.env` dentro del esquema.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService<AppConfig, true>) {
    const database = configService.get('database', { infer: true });
    const isDevelopment = configService.get('isDevelopment', { infer: true });

    super({
      adapter: new PrismaPg({ connectionString: database.url }),
      log: isDevelopment ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conexion con PostgreSQL establecida');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Conexion con PostgreSQL cerrada');
  }

  /**
   * Comprobacion de vitalidad usada por `/health`.
   * `SELECT 1` es la consulta mas barata que confirma que el pool responde.
   */
  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }
}
