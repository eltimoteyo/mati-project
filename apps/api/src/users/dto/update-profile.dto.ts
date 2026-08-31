import { VALIDATION_MESSAGES, VALIDATION_RULES } from '@conit/validation';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Datos del perfil que el propio usuario puede editar.
 *
 * El correo y el rol quedan fuera a proposito: cambiar el correo altera la
 * identidad de acceso y el rol es una decision de administracion, no de perfil.
 */
export class UpdateProfileDto {
  @ApiProperty({
    minLength: VALIDATION_RULES.name.minLength,
    maxLength: VALIDATION_RULES.name.maxLength,
    example: 'Administrador CONIT',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(VALIDATION_RULES.name.minLength, { message: VALIDATION_MESSAGES.name.minLength })
  @MaxLength(VALIDATION_RULES.name.maxLength, { message: VALIDATION_MESSAGES.name.maxLength })
  name!: string;
}
