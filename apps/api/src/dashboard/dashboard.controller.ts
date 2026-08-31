import type { DashboardSummary } from '@conit/types';
import { USER_ROLES } from '@conit/types';
import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ResponseMessage } from '../common/decorators/response.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiEnvelopeResponse } from '../common/dto/api-response.dto';
import { DashboardService } from './dashboard.service';
import { DashboardSummaryDto } from './dto/dashboard-response.dto';

@ApiTags('Dashboard')
@ApiCookieAuth('conit_at')
@Roles(USER_ROLES.ADMIN)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ResponseMessage('Resumen obtenido correctamente')
  @ApiOperation({
    summary: 'Resumen del panel',
    description:
      'Metricas de cola, serie de volumen de los ultimos 14 dias, distribucion por tipo de ' +
      'servicio y actividad reciente. Todo se agrega en el servidor en una sola peticion.',
  })
  @ApiEnvelopeResponse(DashboardSummaryDto)
  getSummary(): Promise<DashboardSummary> {
    return this.dashboardService.getSummary();
  }
}
