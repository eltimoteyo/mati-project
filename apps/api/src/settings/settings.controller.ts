import type { AiLimitsSettings, AutomationSettings } from '@conit/types';
import { USER_ROLES } from '@conit/types';
import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ResponseMessage } from '../common/decorators/response.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiEnvelopeResponse } from '../common/dto/api-response.dto';
import {
  AiLimitsSettingsResponseDto,
  UpdateAiLimitsSettingsDto,
} from './dto/ai-limits-settings.dto';
import {
  AutomationSettingsResponseDto,
  UpdateAutomationSettingsDto,
} from './dto/automation-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@ApiCookieAuth('conit_at')
@Roles(USER_ROLES.ADMIN)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('automation')
  @ResponseMessage('Ajustes de automatizacion obtenidos correctamente')
  @ApiOperation({ summary: 'Ajustes de automatizacion' })
  @ApiEnvelopeResponse(AutomationSettingsResponseDto)
  getAutomation(): Promise<AutomationSettings> {
    return this.settingsService.getAutomation();
  }

  @Patch('automation')
  @ResponseMessage('Ajustes de automatizacion guardados')
  @ApiOperation({
    summary: 'Cambiar los ajustes de automatizacion',
    description: 'Solo se cambian los campos enviados.',
  })
  @ApiEnvelopeResponse(AutomationSettingsResponseDto)
  updateAutomation(@Body() dto: UpdateAutomationSettingsDto): Promise<AutomationSettings> {
    return this.settingsService.updateAutomation(dto);
  }

  @Get('ai-limits')
  @ResponseMessage('Limites de la IA obtenidos correctamente')
  @ApiOperation({ summary: 'Limites de la IA: tokens, tiempos, concurrencia y presupuesto' })
  @ApiEnvelopeResponse(AiLimitsSettingsResponseDto)
  getAiLimits(): Promise<AiLimitsSettings> {
    return this.settingsService.getAiLimits();
  }

  @Patch('ai-limits')
  @ResponseMessage('Limites de la IA guardados')
  @ApiOperation({
    summary: 'Cambiar los limites de la IA',
    description: 'Solo se cambian los campos enviados. Se aplican en la siguiente respuesta.',
  })
  @ApiEnvelopeResponse(AiLimitsSettingsResponseDto)
  updateAiLimits(@Body() dto: UpdateAiLimitsSettingsDto): Promise<AiLimitsSettings> {
    return this.settingsService.updateAiLimits(dto);
  }
}
