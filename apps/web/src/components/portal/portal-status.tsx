import { TICKET_STATUS_LABELS, type TicketStatus } from '@conit/types';
import { cn } from '@conit/ui';
import {
  CheckCircle2Icon,
  CircleDotIcon,
  ClockIcon,
  type LucideIcon,
  SearchIcon,
  WrenchIcon,
} from 'lucide-react';

/**
 * Presentacion de los estados en el portal.
 *
 * Se define aparte de la del panel porque el mensaje es distinto: al equipo le
 * interesa el estado del flujo de trabajo, y al cliente, saber si alguien esta
 * ya con lo suyo. De ahi que cada estado lleve una frase explicativa.
 */

interface StatusPresentation {
  icon: LucideIcon;
  /** Que significa para el cliente. */
  hint: string;
  className: string;
  dotClassName: string;
}

export const PORTAL_STATUS: Record<TicketStatus, StatusPresentation> = {
  NEW: {
    icon: ClockIcon,
    hint: 'La hemos recibido y esta en cola para revisarse.',
    className: 'border-border bg-muted text-foreground',
    dotClassName: 'bg-muted-foreground',
  },
  IN_REVIEW: {
    icon: SearchIcon,
    hint: 'Un tecnico la esta analizando.',
    className: 'border-primary/20 bg-primary/[0.08] text-primary',
    dotClassName: 'bg-primary',
  },
  IN_PROGRESS: {
    icon: WrenchIcon,
    hint: 'Estamos trabajando en la solucion.',
    className: 'border-warning/25 bg-warning/10 text-warning',
    dotClassName: 'bg-warning',
  },
  RESOLVED: {
    icon: CheckCircle2Icon,
    hint: 'Resuelta. Si el problema vuelve, escribenos aqui mismo.',
    className: 'border-success/25 bg-success/10 text-success',
    dotClassName: 'bg-success',
  },
  CLOSED: {
    icon: CircleDotIcon,
    hint: 'Cerrada. Puedes consultarla cuando quieras.',
    className: 'border-border bg-muted text-muted-foreground',
    dotClassName: 'bg-muted-foreground',
  },
};

export function PortalStatusBadge({
  status,
  className,
}: {
  status: TicketStatus;
  className?: string;
}) {
  const { icon: Icon, className: tone } = PORTAL_STATUS[status];

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        tone,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {TICKET_STATUS_LABELS[status]}
    </span>
  );
}
