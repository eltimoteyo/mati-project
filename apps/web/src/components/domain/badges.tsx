import {
  CATEGORY_COLORS,
  type CategoryColor,
  type CategoryRef,
  CLIENT_STATUSES,
  type ClientStatus,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  type ProjectStatus,
  SERVICE_TYPE_LABELS,
  type ServiceType,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_STATUSES,
  type TicketPriority,
  type TicketStatus,
} from '@conit/types';
import { Badge, type BadgeProps } from '@conit/ui';

type Variant = BadgeProps['variant'];

/* -----------------------------------------------------------------------------
 * Estado del ticket
 * -------------------------------------------------------------------------- */

/**
 * El color sigue la urgencia, no el orden del flujo: lo nuevo destaca en color
 * de marca, lo que esta en curso avisa en ambar y lo resuelto se apaga en
 * verde. Cerrado queda neutro porque ya no requiere atencion.
 */
const STATUS_VARIANTS: Record<TicketStatus, Variant> = {
  [TICKET_STATUSES.NEW]: 'default',
  [TICKET_STATUSES.IN_REVIEW]: 'info',
  [TICKET_STATUSES.IN_PROGRESS]: 'warning',
  [TICKET_STATUSES.RESOLVED]: 'success',
  [TICKET_STATUSES.CLOSED]: 'neutral',
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{TICKET_STATUS_LABELS[status]}</Badge>;
}

/* -----------------------------------------------------------------------------
 * Prioridad
 * -------------------------------------------------------------------------- */

const PRIORITY_VARIANTS: Record<TicketPriority, Variant> = {
  [TICKET_PRIORITIES.LOW]: 'neutral',
  [TICKET_PRIORITIES.MEDIUM]: 'info',
  [TICKET_PRIORITIES.HIGH]: 'warning',
  [TICKET_PRIORITIES.CRITICAL]: 'danger',
};

export function TicketPriorityBadge({ priority }: { priority: TicketPriority }) {
  return <Badge variant={PRIORITY_VARIANTS[priority]}>{TICKET_PRIORITY_LABELS[priority]}</Badge>;
}

/* -----------------------------------------------------------------------------
 * Categoria
 * -------------------------------------------------------------------------- */

const CATEGORY_VARIANTS: Record<CategoryColor, Variant> = {
  [CATEGORY_COLORS.BRAND]: 'default',
  [CATEGORY_COLORS.INFO]: 'info',
  [CATEGORY_COLORS.SUCCESS]: 'success',
  [CATEGORY_COLORS.WARNING]: 'warning',
  [CATEGORY_COLORS.DANGER]: 'danger',
  [CATEGORY_COLORS.NEUTRAL]: 'neutral',
};

export function CategoryBadge({ category }: { category: CategoryRef | null }) {
  if (!category) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return <Badge variant={CATEGORY_VARIANTS[category.color]}>{category.name}</Badge>;
}

/** Traduce el color semantico a la variante del design system. */
export function categoryVariant(color: CategoryColor): Variant {
  return CATEGORY_VARIANTS[color];
}

/* -----------------------------------------------------------------------------
 * Servicios y clientes
 * -------------------------------------------------------------------------- */

export function ServiceTypeBadge({ type }: { type: ServiceType }) {
  return <Badge variant="outline">{SERVICE_TYPE_LABELS[type]}</Badge>;
}

const PROJECT_STATUS_VARIANTS: Record<ProjectStatus, Variant> = {
  [PROJECT_STATUSES.ACTIVE]: 'success',
  [PROJECT_STATUSES.SUSPENDED]: 'warning',
  [PROJECT_STATUSES.ARCHIVED]: 'neutral',
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge variant={PROJECT_STATUS_VARIANTS[status]}>{PROJECT_STATUS_LABELS[status]}</Badge>;
}

export function ActiveStatusBadge({ status }: { status: ClientStatus }) {
  return (
    <Badge variant={status === CLIENT_STATUSES.ACTIVE ? 'success' : 'neutral'}>
      {status === CLIENT_STATUSES.ACTIVE ? 'Activo' : 'Inactivo'}
    </Badge>
  );
}
