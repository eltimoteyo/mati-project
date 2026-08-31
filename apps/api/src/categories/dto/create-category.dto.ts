import { CATEGORY_COLORS, CATEGORY_STATUSES, type CategoryColor, type CategoryStatus } from '@conit/types';
import { VALIDATION_RULES } from '@conit/validation';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const rules = VALIDATION_RULES.category;

/** Convierte cadena vacia en `null`, para distinguir "sin valor" de "vacio". */
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

export class CreateCategoryDto {
  @ApiProperty({ minLength: rules.name.minLength, maxLength: rules.name.maxLength })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(rules.name.minLength, {
    message: `El nombre debe tener al menos ${rules.name.minLength} caracteres.`,
  })
  @MaxLength(rules.name.maxLength, {
    message: `El nombre no puede superar los ${rules.name.maxLength} caracteres.`,
  })
  name!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: rules.description.maxLength })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(rules.description.maxLength)
  description?: string | null;

  @ApiPropertyOptional({ enum: Object.values(CATEGORY_COLORS), default: CATEGORY_COLORS.NEUTRAL })
  @IsOptional()
  @IsEnum(CATEGORY_COLORS, { message: 'El color seleccionado no es valido.' })
  color?: CategoryColor;

  @ApiPropertyOptional({
    nullable: true,
    minimum: rules.time.min,
    maximum: rules.time.max,
    description: 'Tiempo objetivo de primera respuesta, en minutos.',
  })
  @Transform(emptyToNull)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(rules.time.min)
  @Max(rules.time.max)
  responseTimeMinutes?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    minimum: rules.time.min,
    maximum: rules.time.max,
    description: 'Tiempo objetivo de resolucion, en minutos.',
  })
  @Transform(emptyToNull)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(rules.time.min)
  @Max(rules.time.max)
  resolutionTimeMinutes?: number | null;

  @ApiPropertyOptional({ enum: Object.values(CATEGORY_STATUSES), default: CATEGORY_STATUSES.ACTIVE })
  @IsOptional()
  @IsEnum(CATEGORY_STATUSES)
  status?: CategoryStatus;
}
