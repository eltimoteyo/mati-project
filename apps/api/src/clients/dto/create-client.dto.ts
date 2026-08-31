import { CLIENT_STATUSES, type ClientStatus } from '@conit/types';
import { VALIDATION_MESSAGES, VALIDATION_RULES } from '@conit/validation';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const rules = VALIDATION_RULES.client;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const emptyToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
};

export class CreateClientDto {
  @ApiProperty({ example: 'Distribuidora Andina S.A.C.' })
  @Transform(trim)
  @IsString()
  @MinLength(rules.name.minLength, {
    message: `El nombre debe tener al menos ${rules.name.minLength} caracteres.`,
  })
  @MaxLength(rules.name.maxLength)
  name!: string;

  @ApiProperty({ format: 'email', example: 'contacto@distribuidora.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: VALIDATION_MESSAGES.email.invalid })
  @MaxLength(VALIDATION_RULES.email.maxLength)
  email!: string;

  @ApiPropertyOptional({ nullable: true, example: '20123456789', description: 'RUC o equivalente.' })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(rules.taxId.maxLength)
  taxId?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Maria Quispe' })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(rules.contactName.maxLength)
  contactName?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '+51 987 654 321' })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(rules.phone.maxLength)
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(rules.address.maxLength)
  address?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Notas internas, no visibles al cliente.' })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(rules.notes.maxLength)
  notes?: string | null;

  @ApiPropertyOptional({ enum: Object.values(CLIENT_STATUSES), default: CLIENT_STATUSES.ACTIVE })
  @IsOptional()
  @IsEnum(CLIENT_STATUSES)
  status?: ClientStatus;
}
