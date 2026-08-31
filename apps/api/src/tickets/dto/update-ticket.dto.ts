import { TICKET_STATUSES, type TicketStatus } from '@conit/types';
import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

import { CreateTicketDto } from './create-ticket.dto';

/**
 * Edicion de un ticket.
 *
 * `clientId` queda fuera: el ticket pertenece al cliente que reporto la
 * incidencia y reasignarlo falsearia su historial.
 */
export class UpdateTicketDto extends PartialType(
  OmitType(CreateTicketDto, ['clientId'] as const),
) {
  @ApiPropertyOptional({
    enum: Object.values(TICKET_STATUSES),
    description: 'Nuevo estado. Debe ser una transicion permitida desde el estado actual.',
  })
  @IsOptional()
  @IsEnum(TICKET_STATUSES, { message: 'El estado seleccionado no es valido.' })
  status?: TicketStatus;
}
