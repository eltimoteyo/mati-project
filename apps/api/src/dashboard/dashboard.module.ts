import { Module } from '@nestjs/common';

import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/**
 * Vista de solo lectura que agrega datos de varios dominios.
 *
 * No define entidades propias: compone lo que ya modelan `tickets`, `clients`
 * y `projects`. Cuando llegue el modulo de reportes, sus consultas nacerian
 * aqui como caso particular.
 */
@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
