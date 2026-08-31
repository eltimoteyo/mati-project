import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';

import { Public } from '../common/decorators/public.decorator';
import { RawResponse } from '../common/decorators/response.decorator';
import { PrismaHealthIndicator } from './prisma.health-indicator';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
  ) {}

  /**
   * Comprobacion de estado del servicio.
   *
   * Devuelve la forma nativa de Terminus (`{ status, info, error, details }`)
   * sin la envoltura estandar, porque este contrato lo consumen Docker,
   * balanceadores y monitorizacion externa.
   */
  @Public()
  @RawResponse()
  @Get('health')
  @HealthCheck()
  @ApiOperation({
    summary: 'Estado del servicio',
    description:
      'Verifica que la API responde y que la conexion con PostgreSQL esta operativa. ' +
      'Responde 503 si alguna dependencia critica falla.',
  })
  @ApiOkResponse({
    description: 'Servicio operativo.',
    schema: {
      example: {
        status: 'ok',
        info: { database: { status: 'up', responseTime: 3 } },
        error: {},
        details: { database: { status: 'up', responseTime: 3 } },
      },
    },
  })
  check() {
    return this.health.check([() => this.prismaIndicator.check('database')]);
  }
}
