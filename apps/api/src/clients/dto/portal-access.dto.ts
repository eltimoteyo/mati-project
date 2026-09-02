import { VALIDATION_RULES } from '@conit/validation';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const rules = VALIDATION_RULES;

export class GrantPortalAccessDto {
  @ApiProperty({
    minLength: rules.password.minLength,
    maxLength: rules.password.maxLength,
    description: 'Contrasena inicial del cliente.',
  })
  @IsString()
  @MinLength(rules.password.minLength, {
    message: `La contrasena debe tener al menos ${rules.password.minLength} caracteres.`,
  })
  @MaxLength(rules.password.maxLength)
  password!: string;

  @ApiPropertyOptional({
    minLength: rules.name.minLength,
    maxLength: rules.name.maxLength,
    description: 'Nombre de la persona que entrara. Por defecto, el contacto de la ficha.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MinLength(rules.name.minLength)
  @MaxLength(rules.name.maxLength)
  name?: string;

  @ApiPropertyOptional({
    default: false,
    description:
      'Envia las credenciales al correo del cliente. Es la unica ocasion de hacerlo: despues solo queda el hash.',
  })
  @Transform(({ value }) => value === true || value === 'true')
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;
}
