import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '../interfaces/authenticated-request.interface';

/**
 * Inyecta el usuario autenticado en un parametro del controlador.
 *
 * @example
 * ```ts
 * findMe(@CurrentUser() user: AuthenticatedUser) {}
 * findMyId(@CurrentUser('id') userId: string) {}
 * ```
 */
export const CurrentUser = createParamDecorator(
  (property: keyof AuthenticatedUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    return property ? user?.[property] : user;
  },
);
