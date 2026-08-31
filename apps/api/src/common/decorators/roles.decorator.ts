import type { UserRole } from '@conit/types';
import { SetMetadata } from '@nestjs/common';

import { METADATA_KEYS } from '../constants/app.constants';

/**
 * Restringe un endpoint a los roles indicados.
 * La comprobacion la realiza `RolesGuard`, registrado globalmente.
 *
 * @example
 * ```ts
 * @Roles(USER_ROLES.ADMIN)
 * @Get('usuarios')
 * findAll() {}
 * ```
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(METADATA_KEYS.roles, roles);
