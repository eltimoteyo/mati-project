/**
 * Categoria de incidencia.
 *
 * Clasifica los tickets y define los tiempos objetivo de atencion, que en la
 * Fase 3 alimentaran los indicadores de cumplimiento de los reportes.
 */

export const CATEGORY_STATUSES = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export type CategoryStatus = (typeof CATEGORY_STATUSES)[keyof typeof CATEGORY_STATUSES];

/**
 * Color asociado a la categoria.
 *
 * Es un identificador semantico, no un valor hexadecimal: la interfaz lo
 * traduce a los tokens del design system, de modo que las categorias siguen
 * siendo legibles en tema claro y oscuro y no pueden romper la paleta.
 */
export const CATEGORY_COLORS = {
  BRAND: 'BRAND',
  INFO: 'INFO',
  SUCCESS: 'SUCCESS',
  WARNING: 'WARNING',
  DANGER: 'DANGER',
  NEUTRAL: 'NEUTRAL',
} as const;

export type CategoryColor = (typeof CATEGORY_COLORS)[keyof typeof CATEGORY_COLORS];

export interface Category {
  id: string;
  name: string;
  /** Identificador estable en minusculas, util para filtros en la URL. */
  slug: string;
  description: string | null;
  color: CategoryColor;
  /** Tiempo objetivo de primera respuesta, en minutos. */
  responseTimeMinutes: number | null;
  /** Tiempo objetivo de resolucion, en minutos. */
  resolutionTimeMinutes: number | null;
  status: CategoryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryWithCounts extends Category {
  counts: {
    tickets: number;
  };
}

export interface CreateCategoryInput {
  name: string;
  description?: string | null;
  color?: CategoryColor;
  responseTimeMinutes?: number | null;
  resolutionTimeMinutes?: number | null;
  status?: CategoryStatus;
}

export type UpdateCategoryInput = Partial<CreateCategoryInput>;

export interface CategoryRef {
  id: string;
  name: string;
  color: CategoryColor;
}
