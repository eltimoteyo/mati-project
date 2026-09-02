import type { ReportSummary } from '@conit/types';
import { USER_ROLES } from '@conit/types';
import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { RawResponse, ResponseMessage } from '../common/decorators/response.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiEnvelopeResponse } from '../common/dto/api-response.dto';
import { ReportQueryDto } from './dto/report-query.dto';
import { ReportSummaryDto } from './dto/report-response.dto';
import { ReportsService } from './reports.service';

/**
 * Marca de orden de bytes UTF-8.
 *
 * Excel abre un CSV sin BOM como ANSI y rompe los acentos. Se declara con el
 * escape y no con el caracter literal porque este es invisible en el editor.
 */
const UTF8_BOM = '\uFEFF';

@ApiTags('Reports')
@ApiCookieAuth('conit_at')
@Roles(USER_ROLES.ADMIN)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @ResponseMessage('Reporte generado correctamente')
  @ApiOperation({
    summary: 'Reporte operativo',
    description:
      'Volumen, tiempos medios, cumplimiento de objetivos y desgloses del periodo indicado.',
  })
  @ApiEnvelopeResponse(ReportSummaryDto)
  getSummary(@Query() query: ReportQueryDto): Promise<ReportSummary> {
    return this.reportsService.getSummary(query);
  }

  /**
   * Exportacion CSV.
   *
   * Escribe directamente en la respuesta para saltarse el sobre JSON: un
   * fichero descargable no puede venir envuelto en `{ data: ... }`.
   */
  @Get('export')
  @RawResponse()
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Exportar los tickets del periodo a CSV' })
  @ApiProduces('text/csv')
  @ApiResponse({ status: 200, description: 'Fichero CSV con los tickets del periodo.' })
  async exportCsv(@Query() query: ReportQueryDto, @Res() response: Response): Promise<void> {
    const csv = await this.reportsService.exportCsv(query);
    const stamp = new Date().toISOString().slice(0, 10);

    response.setHeader(
      'Content-Disposition',
      `attachment; filename="conit-tickets-${stamp}.csv"`,
    );

    response.send(`${UTF8_BOM}${csv}`);
  }
}
