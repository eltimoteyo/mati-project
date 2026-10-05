import type { AiClassification, AiStatus, AiSuggestion, AiSummary } from '@conit/types';
import { USER_ROLES } from '@conit/types';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ResponseMessage } from '../common/decorators/response.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiEnvelopeResponse, ApiErrorResponse } from '../common/dto/api-response.dto';
import { AiService } from './ai.service';
import {
  AiClassificationDto,
  AiStatusDto,
  AiSuggestionDto,
  AiSummaryDto,
  SuggestReplyDto,
} from './dto/ai.dto';

/**
 * Asistente de soporte.
 *
 * Todos los endpoints **proponen**; ninguno escribe en el ticket. La respuesta
 * sugerida vuelve al editor y la clasificacion, a un aviso con su boton de
 * aplicar: quien decide sigue siendo el agente.
 */
@ApiTags('AI')
@ApiCookieAuth('conit_at')
@Roles(USER_ROLES.ADMIN, USER_ROLES.SYSTEMS)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('status')
  @ResponseMessage('Estado del asistente obtenido correctamente')
  @ApiOperation({
    summary: 'Estado del asistente',
    description:
      'Permite a la interfaz ocultar las acciones de IA cuando no hay proveedor configurado.',
  })
  @ApiEnvelopeResponse(AiStatusDto)
  getStatus(): AiStatus {
    return this.aiService.getStatus();
  }

  @Post('tickets/:idOrCode/reply')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Respuesta sugerida correctamente')
  @ApiOperation({
    summary: 'Sugerir una respuesta',
    description: 'Devuelve un borrador; no publica nada en la conversacion.',
  })
  @ApiEnvelopeResponse(AiSuggestionDto)
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'El ticket no existe.')
  @ApiErrorResponse(HttpStatus.SERVICE_UNAVAILABLE, 'El asistente no esta disponible.')
  suggestReply(
    @Param('idOrCode') idOrCode: string,
    @Body() dto: SuggestReplyDto,
  ): Promise<AiSuggestion> {
    return this.aiService.suggestReply(idOrCode, dto);
  }

  @Post('tickets/:idOrCode/classify')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Clasificacion sugerida correctamente')
  @ApiOperation({
    summary: 'Sugerir categoria y prioridad',
    description: 'La categoria se elige de entre las existentes; no se crea ninguna nueva.',
  })
  @ApiEnvelopeResponse(AiClassificationDto)
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'El ticket no existe.')
  @ApiErrorResponse(HttpStatus.SERVICE_UNAVAILABLE, 'El asistente no esta disponible.')
  classify(@Param('idOrCode') idOrCode: string): Promise<AiClassification> {
    return this.aiService.classify(idOrCode);
  }

  @Post('tickets/:idOrCode/summary')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Resumen generado correctamente')
  @ApiOperation({
    summary: 'Resumir el caso',
    description: 'Resumen y proximos pasos, para que otro agente pueda retomarlo.',
  })
  @ApiEnvelopeResponse(AiSummaryDto)
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'El ticket no existe.')
  @ApiErrorResponse(HttpStatus.SERVICE_UNAVAILABLE, 'El asistente no esta disponible.')
  summarize(@Param('idOrCode') idOrCode: string): Promise<AiSummary> {
    return this.aiService.summarize(idOrCode);
  }
}
