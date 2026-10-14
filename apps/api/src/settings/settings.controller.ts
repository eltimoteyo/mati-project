import type { AutomationSettings } from '@conit/types';
import { USER_ROLES } from '@conit/types';
import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ResponseMessage } from '../common/decorators/response.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiEnvelopeResponse } from '../common/dto/api-response.dto';
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
}
