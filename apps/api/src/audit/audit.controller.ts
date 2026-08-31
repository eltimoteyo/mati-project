import type { AuditEntry, AuditSummary, PaginatedData } from '@conit/types';
import { USER_ROLES } from '@conit/types';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ResponseMessage } from '../common/decorators/response.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiEnvelopeResponse, ApiPaginatedResponse } from '../common/dto/api-response.dto';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';
import { AuditEntryDto, AuditSummaryDto } from './dto/audit-response.dto';

/**
 * Historial de auditoria.
 *
 * Solo expone lecturas. No hay ningun endpoint de escritura ni de borrado: los
 * eventos los generan los modulos que cambian el dato, y poder alterarlos
 * desde fuera invalidaria el registro.
 */
@ApiTags('Audit')
@ApiCookieAuth('conit_at')
@Roles(USER_ROLES.ADMIN)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ResponseMessage('Historial obtenido correctamente')
  @ApiOperation({
    summary: 'Listar el historial',
    description:
      'Eventos de todos los tickets, con filtros por tipo, autor, ticket y rango de fechas.',
  })
  @ApiPaginatedResponse(AuditEntryDto)
  findAll(@Query() query: AuditQueryDto): Promise<PaginatedData<AuditEntry>> {
    return this.auditService.findAll(query);
  }

  @Get('summary')
  @ResponseMessage('Resumen del historial obtenido correctamente')
  @ApiOperation({
    summary: 'Resumen del historial',
    description: 'Cifras calculadas sobre el mismo filtro que el listado.',
  })
  @ApiEnvelopeResponse(AuditSummaryDto)
  getSummary(@Query() query: AuditQueryDto): Promise<AuditSummary> {
    return this.auditService.getSummary(query);
  }
}
