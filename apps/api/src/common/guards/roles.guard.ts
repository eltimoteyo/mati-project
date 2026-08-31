import type { UserRole } from '@conit/types';
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { METADATA_KEYS } from '../constants/app.constants';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

/**
 * Autorizacion por rol.
 *
 * Se ejecuta despues de `JwtAuthGuard`, por lo que puede asumir que la
 * peticion ya tiene usuario. Si el endpoint no declara `@Roles(...)`,
 * basta con estar autenticado.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(METADATA_KEYS.roles, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('No tienes permisos para realizar esta accion');
    }

    return true;
  }
}
