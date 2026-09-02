import { TICKET_STATUSES, type TicketStatus } from '@conit/types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination.dto';

/**
 * Filtros del listado del portal.
 *
 * No hay filtro por cliente ni por responsable: el ambito lo fija la sesion, y
 * ofrecerlos aqui solo invitaria a intentar salirse de el.
 */
export class PortalTicketQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: Object.values(TICKET_STATUSES) })
  @IsOptional()
  @IsEnum(TICKET_STATUSES, { message: 'El estado seleccionado no es valido.' })
  status?: TicketStatus;

  @ApiPropertyOptional({ description: 'Limita a las incidencias en curso.' })
  @Transform(({ value }) => value === true || value === 'true')
  @IsOptional()
  @IsBoolean()
  openOnly?: boolean;
}
