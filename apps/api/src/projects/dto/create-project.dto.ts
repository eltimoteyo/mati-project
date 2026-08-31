import {
  PROJECT_STATUSES,
  type ProjectStatus,
  SERVICE_TYPES,
  type ServiceType,
} from '@conit/types';
import { VALIDATION_RULES } from '@conit/validation';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

const rules = VALIDATION_RULES.project;

const emptyToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
};

export class CreateProjectDto {
  @ApiProperty({ format: 'uuid', description: 'Cliente propietario del servicio.' })
  @IsUUID('4', { message: 'Selecciona un cliente valido.' })
  clientId!: string;

  @ApiProperty({ example: 'Portal institucional' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(rules.name.minLength, {
    message: `El nombre debe tener al menos ${rules.name.minLength} caracteres.`,
  })
  @MaxLength(rules.name.maxLength)
  name!: string;

  @ApiProperty({ enum: Object.values(SERVICE_TYPES) })
  @IsEnum(SERVICE_TYPES, { message: 'Selecciona un tipo de servicio valido.' })
  type!: ServiceType;

  @ApiPropertyOptional({ nullable: true })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(rules.description.maxLength)
  description?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'https://cliente.com' })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(rules.url.maxLength)
  url?: string | null;

  @ApiPropertyOptional({ enum: Object.values(PROJECT_STATUSES), default: PROJECT_STATUSES.ACTIVE })
  @IsOptional()
  @IsEnum(PROJECT_STATUSES)
  status?: ProjectStatus;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  @Transform(emptyToNull)
  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'La fecha de inicio no es valida.' })
  startedAt?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    format: 'date-time',
    description: 'Vencimiento del servicio (hosting, dominio...).',
  })
  @Transform(emptyToNull)
  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'La fecha de vencimiento no es valida.' })
  expiresAt?: string | null;
}
