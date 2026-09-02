import {
  type Notification,
  NOTIFICATION_TYPES,
  type NotificationCount,
  type NotificationPreference,
  type NotificationTicketRef,
  type NotificationType,
} from '@conit/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum } from 'class-validator';

class NotificationTicketRefDto implements NotificationTicketRef {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'CNT-0042' })
  code!: string;
}

export class NotificationResponseDto implements Notification {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: Object.values(NOTIFICATION_TYPES) })
  type!: NotificationType;

  @ApiProperty({ example: 'Se te ha asignado un ticket' })
  title!: string;

  @ApiProperty({ example: 'CNT-0042 · El certificado SSL caduca esta semana' })
  body!: string;

  @ApiPropertyOptional({ type: NotificationTicketRefDto, nullable: true })
  ticket!: NotificationTicketRef | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  readAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class NotificationCountDto implements NotificationCount {
  @ApiProperty({ example: 3 })
  unread!: number;
}

export class NotificationPreferenceDto implements NotificationPreference {
  @ApiProperty({ enum: Object.values(NOTIFICATION_TYPES) })
  @IsEnum(NOTIFICATION_TYPES, { message: 'El tipo de aviso no es valido.' })
  type!: NotificationType;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}
