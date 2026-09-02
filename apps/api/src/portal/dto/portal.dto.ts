import {
  type CreatePortalMessageInput,
  type CreatePortalTicketInput,
  TICKET_PRIORITIES,
  type TicketPriority,
} from '@conit/types';
import { VALIDATION_RULES } from '@conit/validation';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

const ticket = VALIDATION_RULES.ticket;
const message = VALIDATION_RULES.message;

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Alta de incidencia desde el portal.
 *
 * No admite `clientId`, `assigneeId` ni `status`. Con `forbidNonWhitelisted`
 * activo, enviarlos devuelve 400 en lugar de ignorarse en silencio: quien lo
 * intente sabra que no cuela, y nosotros no dependemos de recordar filtrarlos.
 */
export class CreatePortalTicketDto implements CreatePortalTicketInput {
  @ApiProperty({
    minLength: ticket.subject.minLength,
    maxLength: ticket.subject.maxLength,
    example: 'El correo corporativo no envia desde ayer',
  })
  @Transform(trim)
  @IsString()
  @MinLength(ticket.subject.minLength, {
    message: `El asunto debe tener al menos ${ticket.subject.minLength} caracteres.`,
  })
  @MaxLength(ticket.subject.maxLength)
  subject!: string;

  @ApiProperty({
    minLength: ticket.description.minLength,
    maxLength: ticket.description.maxLength,
    description: 'Que ocurre, desde cuando y a quien afecta.',
  })
  @Transform(trim)
  @IsString()
  @MinLength(ticket.description.minLength, {
    message: `Describe la incidencia con al menos ${ticket.description.minLength} caracteres.`,
  })
  @MaxLength(ticket.description.maxLength)
  description!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Servicio afectado, si aplica.' })
  @IsOptional()
  @IsUUID('4')
  projectId?: string | null;

  @ApiPropertyOptional({
    enum: Object.values(TICKET_PRIORITIES),
    default: TICKET_PRIORITIES.MEDIUM,
    description: 'Como de urgente es para el cliente. Soporte puede reajustarla.',
  })
  @IsOptional()
  @IsEnum(TICKET_PRIORITIES, { message: 'La prioridad seleccionada no es valida.' })
  priority?: TicketPriority;
}

export class CreatePortalMessageDto implements CreatePortalMessageInput {
  @ApiProperty({ minLength: message.body.minLength, maxLength: message.body.maxLength })
  @Transform(trim)
  @IsString()
  @MinLength(message.body.minLength, { message: 'El mensaje no puede estar vacio.' })
  @MaxLength(message.body.maxLength)
  body!: string;
}
