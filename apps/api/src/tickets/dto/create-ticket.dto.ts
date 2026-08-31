import { TICKET_PRIORITIES, type TicketPriority } from '@conit/types';
import { VALIDATION_RULES } from '@conit/validation';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

const rules = VALIDATION_RULES.ticket;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

const emptyToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
};

export class CreateTicketDto {
  @ApiProperty({ example: 'Certificado SSL proximo a vencer' })
  @Transform(trim)
  @IsString()
  @MinLength(rules.subject.minLength, {
    message: `El asunto debe tener al menos ${rules.subject.minLength} caracteres.`,
  })
  @MaxLength(rules.subject.maxLength)
  subject!: string;

  @ApiProperty({ description: 'Detalle de la incidencia reportada.' })
  @Transform(trim)
  @IsString()
  @MinLength(rules.description.minLength, {
    message: `La descripcion debe tener al menos ${rules.description.minLength} caracteres.`,
  })
  @MaxLength(rules.description.maxLength)
  description!: string;

  @ApiProperty({ format: 'uuid', description: 'Cliente que reporta la incidencia.' })
  @IsUUID('4', { message: 'Selecciona un cliente valido.' })
  clientId!: string;

  @ApiPropertyOptional({
    nullable: true,
    format: 'uuid',
    description: 'Servicio afectado. Debe pertenecer al cliente indicado.',
  })
  @Transform(emptyToNull)
  @IsOptional()
  @IsUUID('4', { message: 'Selecciona un servicio valido.' })
  projectId?: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  @Transform(emptyToNull)
  @IsOptional()
  @IsUUID('4', { message: 'Selecciona una categoria valida.' })
  categoryId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    format: 'uuid',
    description: 'Responsable de soporte. Debe ser un usuario con rol ADMIN.',
  })
  @Transform(emptyToNull)
  @IsOptional()
  @IsUUID('4', { message: 'Selecciona un responsable valido.' })
  assigneeId?: string | null;

  @ApiPropertyOptional({
    enum: Object.values(TICKET_PRIORITIES),
    default: TICKET_PRIORITIES.MEDIUM,
  })
  @IsOptional()
  @IsEnum(TICKET_PRIORITIES, { message: 'La prioridad seleccionada no es valida.' })
  priority?: TicketPriority;
}
