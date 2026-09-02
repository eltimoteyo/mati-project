import { NOTIFICATION_TYPES, type NotificationType } from '@conit/types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class NotificationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Limita a las notificaciones sin leer.' })
  @Transform(({ value }) => value === true || value === 'true')
  @IsOptional()
  @IsBoolean()
  unreadOnly?: boolean;

  @ApiPropertyOptional({ enum: Object.values(NOTIFICATION_TYPES) })
  @IsOptional()
  @IsEnum(NOTIFICATION_TYPES, { message: 'El tipo de aviso no es valido.' })
  type?: NotificationType;
}
