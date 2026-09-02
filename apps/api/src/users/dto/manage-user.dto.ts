import {
  USER_ROLES,
  USER_STATUSES,
  type UserRole,
  type UserStatus,
} from '@conit/types';
import { VALIDATION_RULES } from '@conit/validation';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination.dto';

const rules = VALIDATION_RULES;

export const USER_SORT_FIELDS = ['name', 'email', 'createdAt', 'lastLoginAt'] as const;

export type UserSortField = (typeof USER_SORT_FIELDS)[number];

export class UserQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: Object.values(USER_ROLES) })
  @IsOptional()
  @IsEnum(USER_ROLES)
  role?: UserRole;

  @ApiPropertyOptional({ enum: Object.values(USER_STATUSES) })
  @IsOptional()
  @IsEnum(USER_STATUSES)
  status?: UserStatus;

  @ApiPropertyOptional({ enum: USER_SORT_FIELDS, default: 'name' })
  @IsOptional()
  @IsIn(USER_SORT_FIELDS, { message: 'No se puede ordenar por ese campo.' })
  sortBy: UserSortField = 'name';
}

export class CreateUserDto {
  @ApiProperty({ minLength: rules.name.minLength, maxLength: rules.name.maxLength })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(rules.name.minLength)
  @MaxLength(rules.name.maxLength)
  name!: string;

  @ApiProperty({ format: 'email', maxLength: rules.email.maxLength })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'El correo no tiene un formato valido.' })
  @MaxLength(rules.email.maxLength)
  email!: string;

  @ApiProperty({
    minLength: rules.password.minLength,
    maxLength: rules.password.maxLength,
    description: 'Contrasena inicial. No se devuelve nunca; el titular la cambia despues.',
  })
  @IsString()
  @MinLength(rules.password.minLength, {
    message: `La contrasena debe tener al menos ${rules.password.minLength} caracteres.`,
  })
  @MaxLength(rules.password.maxLength)
  password!: string;

  @ApiProperty({
    enum: Object.values(USER_ROLES),
    description: 'ADMIN accede al panel. CLIENT queda reservado para el portal de cliente.',
  })
  @IsEnum(USER_ROLES, { message: 'El rol seleccionado no es valido.' })
  role!: UserRole;

  @ApiPropertyOptional({ enum: Object.values(USER_STATUSES), default: USER_STATUSES.ACTIVE })
  @IsOptional()
  @IsEnum(USER_STATUSES)
  status?: UserStatus;
}

/** La contrasena y el correo no se editan aqui: tienen sus propias vias. */
export class UpdateUserDto {
  @ApiPropertyOptional({ minLength: rules.name.minLength, maxLength: rules.name.maxLength })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MinLength(rules.name.minLength)
  @MaxLength(rules.name.maxLength)
  name?: string;

  @ApiPropertyOptional({ enum: Object.values(USER_ROLES) })
  @IsOptional()
  @IsEnum(USER_ROLES)
  role?: UserRole;

  @ApiPropertyOptional({ enum: Object.values(USER_STATUSES) })
  @IsOptional()
  @IsEnum(USER_STATUSES)
  status?: UserStatus;
}

export class ResetPasswordDto {
  @ApiProperty({ minLength: rules.password.minLength, maxLength: rules.password.maxLength })
  @IsString()
  @MinLength(rules.password.minLength, {
    message: `La contrasena debe tener al menos ${rules.password.minLength} caracteres.`,
  })
  @MaxLength(rules.password.maxLength)
  password!: string;
}
