import type {
  Category as CategoryContract,
  CategoryColor,
  CategoryRef,
  CategoryStatus,
  CategoryWithCounts,
} from '@conit/types';

import type { Category } from '../generated/prisma/client';

/** Registro de Prisma acompanado del recuento de tickets. */
export type CategoryRecord = Category & { _count?: { tickets: number } };

/**
 * Convierte un registro de Prisma en la representacion publica.
 * Lista blanca explicita: una columna nueva no se expone por accidente.
 */
export function toCategory(category: Category): CategoryContract {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    color: category.color as CategoryColor,
    responseTimeMinutes: category.responseTimeMinutes,
    resolutionTimeMinutes: category.resolutionTimeMinutes,
    status: category.status as CategoryStatus,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

export function toCategoryWithCounts(category: CategoryRecord): CategoryWithCounts {
  return {
    ...toCategory(category),
    counts: { tickets: category._count?.tickets ?? 0 },
  };
}

/** Referencia minima para anidar dentro de un ticket. */
export function toCategoryRef(
  category: Pick<Category, 'id' | 'name' | 'color'> | null,
): CategoryRef | null {
  if (!category) return null;

  return { id: category.id, name: category.name, color: category.color as CategoryColor };
}
