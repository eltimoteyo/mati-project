import { TICKET_EVENT_TYPES, type TicketEventType } from '@conit/types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class AuditQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: Object.values(TICKET_EVENT_TYPES),
    description: 'Limita a un tipo de cambio.',
  })
  @IsOptional()
  @IsEnum(TICKET_EVENT_TYPES, { message: 'El tipo de evento no es valido.' })
  type?: TicketEventType;

  @ApiPropertyOptional({ format: 'uuid', description: 'Usuario que provoco el cambio.' })
  @IsOptional()
  @IsUUID('4')
  actorId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  ticketId?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Desde esta fecha, inclusive.',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de inicio no es valida.' })
  from?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Hasta esta fecha, inclusive.',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de fin no es valida.' })
  to?: string;
}
