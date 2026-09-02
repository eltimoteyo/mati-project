import { Module } from '@nestjs/common';

import { SecurityModule } from '../auth/security.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { PortalAccessService } from './portal-access.service';

/**
 * Clientes.
 *
 * Importa `SecurityModule` porque conceder acceso al portal implica crear una
 * cuenta: hace falta el mismo hasheo de contrasenas y la misma revocacion de
 * sesiones que usa el modulo de autenticacion, y duplicarlos abriria la puerta
 * a que divergieran.
 */
@Module({
  imports: [SecurityModule],
  controllers: [ClientsController],
  providers: [ClientsService, PortalAccessService],
  exports: [ClientsService],
})
export class ClientsModule {}
