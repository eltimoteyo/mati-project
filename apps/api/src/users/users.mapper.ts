import type { PublicUser, UserRole, UserStatus } from '@conit/types';

import type { User } from '../generated/prisma/client';

/**
 * Convierte un registro de Prisma en la representacion publica del usuario.
 *
 * Es una lista blanca explicita: cualquier columna nueva del modelo (por
 * ejemplo un futuro `passwordResetToken`) queda fuera por defecto en lugar
 * de filtrarse por accidente con un spread.
 */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    status: user.status as UserStatus,
    avatar: user.avatar,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
