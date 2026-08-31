import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { configuration } from './configuration';
import { validateEnv } from './env.validation';

/**
 * Modulo de configuracion global.
 *
 * Carga y valida el entorno una unica vez; el resto de la aplicacion accede
 * a los valores mediante `ConfigService<AppConfig, true>`.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      // Se leen en orden: el primero que exista gana.
      envFilePath: ['.env.local', '.env', '../../.env'],
      load: [configuration],
      validate: validateEnv,
    }),
  ],
})
export class AppConfigModule {}
