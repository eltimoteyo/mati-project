import type { LoginResponse } from '@conit/types';
import { ApiProperty } from '@nestjs/swagger';

import { UserResponseDto } from '../../users/dto/user-response.dto';

/**
 * Resultado del login y del refresco.
 *
 * No incluye los tokens: se emiten como cookies `httpOnly`. `expiresIn`
 * permite al cliente programar el refresco antes de que caduque la sesion.
 */
export class AuthSessionDto implements LoginResponse {
  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;

  @ApiProperty({
    example: 900,
    description: 'Vigencia del access token en segundos.',
  })
  expiresIn!: number;
}
