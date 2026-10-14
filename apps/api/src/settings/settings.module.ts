import { Global, Module } from '@nestjs/common';

import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

/**
 * Ajustes del sistema editables desde el panel.
 *
 * Es global porque los consultan los modulos que dependen de ellos (la
 * bandeja, para saber si debe responder la IA) sin que eso cree dependencias
 * cruzadas.
 */
@Global()
@Module({
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
