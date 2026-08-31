'use client';

import { TICKET_EVENT_TYPES, type TicketEvent } from '@conit/types';
import { Avatar, AvatarFallback, cn, EmptyState, getInitials } from '@conit/ui';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CircleDotIcon, MessageSquareIcon } from 'lucide-react';

import { describeTicketEvent, TICKET_EVENT_ICONS } from '@/components/domain/ticket-events';

interface TicketTimelineProps {
  events: TicketEvent[];
}

/**
 * Historial del ticket.
 *
 * Se presenta como linea temporal descendente (lo mas reciente arriba), que es
 * el orden en que se consulta un caso en curso. Las notas muestran su texto
 * completo; el resto de eventos son una sola linea.
 */
export function TicketTimeline({ events }: TicketTimelineProps) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={MessageSquareIcon}
        title="Sin actividad registrada"
        description="Los cambios de estado, asignaciones y notas apareceran aqui."
      />
    );
  }

  return (
    <ol className="flex flex-col">
      {events.map((event, index) => {
        const Icon = TICKET_EVENT_ICONS[event.type] ?? CircleDotIcon;
        const isLast = index === events.length - 1;
        const isNote = event.type === TICKET_EVENT_TYPES.NOTE_ADDED;

        return (
          <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
            {/* Linea vertical que une los hitos. */}
            {isLast ? null : (
              <span
                aria-hidden="true"
                className="absolute top-8 bottom-0 left-[0.9375rem] w-px bg-border"
              />
            )}

            <span
              className={cn(
                'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border',
                isNote
                  ? 'border-primary/25 bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground',
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
            </span>

            <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {event.actor?.name ?? 'Sistema'}
                </span>{' '}
                {describeTicketEvent(event)}
              </p>

              {isNote && event.note ? (
                <div className="mt-1 rounded-lg border border-border bg-muted/40 px-3.5 py-2.5">
                  <p className="text-sm whitespace-pre-wrap text-foreground/90">{event.note}</p>
                </div>
              ) : null}

              <time
                dateTime={event.createdAt}
                className="tabular text-xs text-muted-foreground/80"
              >
                {format(new Date(event.createdAt), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
              </time>
            </div>

            {event.actor ? (
              <Avatar className="hidden size-7 shrink-0 sm:flex">
                <AvatarFallback>{getInitials(event.actor.name)}</AvatarFallback>
              </Avatar>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
