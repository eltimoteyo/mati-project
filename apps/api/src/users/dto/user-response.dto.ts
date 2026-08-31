import {
  type PublicUser,
  USER_ROLES,
  USER_STATUSES,
  type UserRole,
  type UserStatus,
} from '@conit/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Representacion publica de un usuario.
 * Es el unico DTO que la API usa para exponer usuarios: nunca incluye
 * `passwordHash` ni informacion de sesion.
 */
export class UserResponseDto implements PublicUser {
  @ApiProperty({ format: 'uuid', example: '8f2a1c4e-9b3d-4f6a-8c1e-2d5b7a9c0e13' })
  id!: string;

  @ApiProperty({ example: 'Administrador CONIT' })
  name!: string;

  @ApiProperty({ format: 'email', example: 'admin@conit.com' })
  email!: string;

  @ApiProperty({ enum: Object.values(USER_ROLES), example: USER_ROLES.ADMIN })
  role!: UserRole;

  @ApiProperty({ enum: Object.values(USER_STATUSES), example: USER_STATUSES.ACTIVE })
  status!: UserStatus;

  @ApiPropertyOptional({ nullable: true, example: null, description: 'URL del avatar.' })
  avatar!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    format: 'date-time',
    description: 'Fecha del ultimo inicio de sesion correcto.',
  })
  lastLoginAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
