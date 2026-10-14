import type { AutomationSettings, UpdateAutomationSettingsInput } from '@conit/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateAutomationSettingsDto implements UpdateAutomationSettingsInput {
  @ApiPropertyOptional({
    description: 'La IA contesta sola los WhatsApp entrantes mientras pueda resolverlos.',
  })
  @IsOptional()
  @IsBoolean({ message: 'El valor debe ser verdadero o falso.' })
  whatsappAutoReply?: boolean;
}

export class AutomationSettingsResponseDto implements AutomationSettings {
  @ApiProperty()
  whatsappAutoReply!: boolean;
}
