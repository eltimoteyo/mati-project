import { VALIDATION_MESSAGES, VALIDATION_RULES } from '@conit/validation';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Cambio de contrasena del propio usuario.
 *
 * Se exige la contrasena actual aunque la sesion ya este iniciada: evita que
 * alguien que encuentre el equipo desbloqueado se apropie de la cuenta.
 */
export class ChangePasswordDto {
  @ApiProperty({ format: 'password', description: 'Contrasena actual, para reautenticar.' })
  @IsString({ message: VALIDATION_MESSAGES.password.required })
  @MinLength(1, { message: VALIDATION_MESSAGES.password.required })
  currentPassword!: string;

  @ApiProperty({
    format: 'password',
    minLength: VALIDATION_RULES.password.minLength,
    maxLength: VALIDATION_RULES.password.maxLength,
  })
  @IsString()
  @MinLength(VALIDATION_RULES.password.minLength, {
    message: VALIDATION_MESSAGES.password.minLength,
  })
  @MaxLength(VALIDATION_RULES.password.maxLength, {
    message: VALIDATION_MESSAGES.password.maxLength,
  })
  newPassword!: string;
}
