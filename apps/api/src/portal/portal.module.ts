import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';

/**
 * Portal del cliente.
 *
 * Se mantiene aparte del modulo de tickets a proposito: comparte las tablas,
 * pero no las reglas. Un cliente no asigna, no cambia estados y no ve notas
 * internas, y mezclar ambos conjuntos de permisos en un mismo servicio es la
 * via mas rapida a una fuga de datos.
 */
@Module({
  imports: [AiModule],
  controllers: [PortalController],
  providers: [PortalService],
})
export class PortalModule {}
