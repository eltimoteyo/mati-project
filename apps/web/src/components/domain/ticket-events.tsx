import { TICKET_EVENT_TYPES, type TicketEvent, type TicketEventType } from '@conit/types';
import {
  ArrowRightIcon,
  CircleDotIcon,
  FlagIcon,
  type LucideIcon,
  MessageSquareIcon,
  PencilIcon,
  PlusIcon,
  TagIcon,
  UserMinusIcon,
  UserPlusIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Presentacion de los eventos de un ticket.
 *
 * Vive aparte porque lo consumen dos vistas: la linea temporal de la ficha y
 * el historial global. Tenerlo en un unico sitio evita que las dos acaben
 * describiendo el mismo cambio con palabras distintas.
 */

export const TICKET_EVENT_ICONS: Record<TicketEventType, LucideIcon> = {
  CREATED: PlusIcon,
  STATUS_CHANGED: CircleDotIcon,
  PRIORITY_CHANGED: FlagIcon,
  ASSIGNED: UserPlusIcon,
  UNASSIGNED: UserMinusIcon,
  CATEGORY_CHANGED: TagIcon,
  NOTE_ADDED: MessageSquareIcon,
  UPDATED: PencilIcon,
};

/** Etiqueta corta, para filtros y recuentos. */
export const TICKET_EVENT_LABELS: Record<TicketEventType, string> = {
  CREATED: 'Creacion',
  STATUS_CHANGED: 'Cambio de estado',
  PRIORITY_CHANGED: 'Cambio de prioridad',
  ASSIGNED: 'Asignacion',
  UNASSIGNED: 'Desasignacion',
  CATEGORY_CHANGED: 'Cambio de categoria',
  NOTE_ADDED: 'Nota',
  UPDATED: 'Edicion',
};

/** Transicion "de X a Y", omitiendo el origen cuando no lo habia. */
export function EventTransition({ from, to }: { from: string | null; to: string | null }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {from ? <span className="font-medium text-foreground">{from}</span> : null}
      {from && to ? (
        <ArrowRightIcon className="size-3 text-muted-foreground" aria-hidden="true" />
      ) : null}
      {to ? <span className="font-medium text-foreground">{to}</span> : null}
    </span>
  );
}

/**
 * Frase que describe el evento.
 *
 * Se redacta en tercera persona sin sujeto para que quien la use anteponga el
 * autor: "Ana cambio el estado: Nuevo -> En proceso".
 */
export function describeTicketEvent(event: TicketEvent): ReactNode {
  switch (event.type) {
    case TICKET_EVENT_TYPES.CREATED:
      return 'registro el ticket';
    case TICKET_EVENT_TYPES.STATUS_CHANGED:
      return (
        <>
          cambio el estado: <EventTransition from={event.fromValue} to={event.toValue} />
        </>
      );
    case TICKET_EVENT_TYPES.PRIORITY_CHANGED:
      return (
        <>
          cambio la prioridad: <EventTransition from={event.fromValue} to={event.toValue} />
        </>
      );
    case TICKET_EVENT_TYPES.ASSIGNED:
      return (
        <>
          asigno el ticket a <EventTransition from={null} to={event.toValue} />
        </>
      );
    case TICKET_EVENT_TYPES.UNASSIGNED:
      return (
        <>
          retiro la asignacion de <EventTransition from={null} to={event.fromValue} />
        </>
      );
    case TICKET_EVENT_TYPES.CATEGORY_CHANGED:
      return (
        <>
          cambio la categoria:{' '}
          <EventTransition
            from={event.fromValue ?? 'Sin clasificar'}
            to={event.toValue ?? 'Sin clasificar'}
          />
        </>
      );
    case TICKET_EVENT_TYPES.NOTE_ADDED:
      return 'anadio una nota';
    case TICKET_EVENT_TYPES.UPDATED:
      return 'actualizo el contenido del ticket';
    default:
      return 'registro un cambio';
  }
}
