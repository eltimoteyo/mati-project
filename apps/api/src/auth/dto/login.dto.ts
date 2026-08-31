import { VALIDATION_MESSAGES, VALIDATION_RULES } from '@conit/validation';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Credenciales de inicio de sesion.
 *
 * Las reglas provienen de `@conit/validation`, el mismo paquete que usa el
 * formulario del frontend, de modo que ambos lados no pueden divergir.
 */
export class LoginDto {
  @ApiProperty({
    format: 'email',
    maxLength: VALIDATION_RULES.email.maxLength,
    example: 'admin@conit.com',
    description: 'Correo corporativo del usuario. Se normaliza a minusculas.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: VALIDATION_MESSAGES.email.invalid })
  @MaxLength(VALIDATION_RULES.email.maxLength, { message: VALIDATION_MESSAGES.email.maxLength })
  email!: string;

  @ApiProperty({
    format: 'password',
    minLength: 1,
    maxLength: VALIDATION_RULES.password.maxLength,
    example: 'TuPasswordSegura123',
    description: 'Contrasena en claro. Viaja unicamente por HTTPS en produccion.',
  })
  @IsString({ message: VALIDATION_MESSAGES.password.required })
  @MinLength(1, { message: VALIDATION_MESSAGES.password.required })
  @MaxLength(VALIDATION_RULES.password.maxLength, {
    message: VALIDATION_MESSAGES.password.maxLength,
  })
  password!: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Extiende la vigencia del refresh token (30 dias en lugar de 7).',
  })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
