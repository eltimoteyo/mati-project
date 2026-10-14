'use client';

import { MESSAGE_SOURCES, TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS } from '@conit/types';
import {
  Avatar,
  AvatarFallback,
  Button,
  Card,
  CardContent,
  cn,
  ErrorState,
  getInitials,
  PageLoader,
  Separator,
  Textarea,
} from '@conit/ui';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeftIcon, SendIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useAddPortalMessage, usePortalTicket } from '@/hooks/use-portal';

import { PORTAL_STATUS, PortalStatusBadge } from './portal-status';

function moment(value: string): string {
  return format(new Date(value), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es });
}

/**
 * Seguimiento de una incidencia.
 *
 * Responde a la pregunta del cliente en este orden: en que estado esta, que ha
 * pasado hasta ahora y como sigue la conversacion.
 */
export function PortalTicketDetail({ code }: { code: string }) {
  const query = usePortalTicket(code);
  const addMessage = useAddPortalMessage(code);
  const [body, setBody] = useState('');

  if (query.isPending) {
    return <PageLoader message="Cargando tu incidencia…" />;
  }

  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="No encontramos esta incidencia"
        description="Puede que el enlace no sea correcto o que ya no este disponible."
        onRetry={() => void query.refetch()}
      />
    );
  }

  const ticket = query.data;
  const presentation = PORTAL_STATUS[ticket.status];

  const send = (event: React.FormEvent) => {
    event.preventDefault();

    const text = body.trim();

    if (!text) return;

    addMessage.mutate({ body: text }, { onSuccess: () => setBody('') });
  };

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/portal/incidencias">
          <ArrowLeftIcon />
          Mis incidencias
        </Link>
      </Button>

      {/* Cabecera --------------------------------------------------------- */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="tabular font-mono text-sm font-semibold text-primary">
            {ticket.code}
          </span>
          <PortalStatusBadge status={ticket.status} />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-balance text-foreground">
          {ticket.subject}
        </h1>

        <p className="text-sm text-muted-foreground">{presentation.hint}</p>
      </div>

      {/* Datos ------------------------------------------------------------- */}
      <Card className="border-border/80 bg-card/90 shadow-subtle">
        <CardContent className="grid gap-4 py-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium tracking-[0.04em] text-muted-foreground uppercase">
              Reportada
            </span>
            <span className="text-sm text-foreground">{moment(ticket.createdAt)}</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium tracking-[0.04em] text-muted-foreground uppercase">
              Urgencia
            </span>
            <span className="text-sm text-foreground">
              {TICKET_PRIORITY_LABELS[ticket.priority]}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium tracking-[0.04em] text-muted-foreground uppercase">
              Servicio
            </span>
            <span className="text-sm text-foreground">
              {ticket.service?.name ?? 'Sin especificar'}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium tracking-[0.04em] text-muted-foreground uppercase">
              Atiende
            </span>
            <span className="text-sm text-foreground">
              {ticket.attendedBy ?? 'Pendiente de asignar'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Lo que se reporto -------------------------------------------------- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-foreground">Lo que reportaste</h2>
        <Card className="border-border/80 bg-card/90 shadow-subtle">
          <CardContent className="py-5">
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
              {ticket.description}
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Seguimiento -------------------------------------------------------- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-foreground">Seguimiento</h2>
        <Card className="border-border/80 bg-card/90 shadow-subtle">
          <CardContent className="py-5">
            <ol className="flex flex-col">
              {ticket.timeline.map((entry, index) => {
                const isLast = index === ticket.timeline.length - 1;
                const step = PORTAL_STATUS[entry.status];
                const Icon = step.icon;

                return (
                  <li
                    key={`${entry.status}-${entry.at ?? 'actual'}`}
                    className="relative flex gap-3 pb-5 last:pb-0"
                  >
                    {isLast ? null : (
                      <span
                        aria-hidden="true"
                        className="absolute top-8 bottom-0 left-[0.9375rem] w-px bg-border"
                      />
                    )}

                    <span
                      className={cn(
                        'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border',
                        isLast ? step.className : 'border-border bg-card text-muted-foreground',
                      )}
                    >
                      <Icon className="size-3.5" aria-hidden="true" />
                    </span>

                    <div className="flex flex-col gap-0.5 pt-1">
                      <span
                        className={cn(
                          'text-sm font-medium',
                          isLast ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {TICKET_STATUS_LABELS[entry.status]}
                      </span>
                      {entry.at ? (
                        <time dateTime={entry.at} className="tabular text-xs text-muted-foreground">
                          {moment(entry.at)}
                        </time>
                      ) : (
                        <span className="text-xs text-muted-foreground">Estado actual</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      </section>

      {/* Conversacion ------------------------------------------------------- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-foreground">Conversacion</h2>

        {ticket.messages.length === 0 ? (
          <Card className="border-border/80 bg-card/90 shadow-subtle">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Aun no hay mensajes. Te escribiremos por aqui en cuanto tengamos novedades.
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {ticket.messages.map((message) => {
              // Los mensajes del propio cliente llegan sin autor de soporte o
              // marcados con su origen; se alinean a la derecha, como en una
              // conversacion normal.
              const isMine =
                message.source === MESSAGE_SOURCES.PORTAL ||
                message.source === MESSAGE_SOURCES.EMAIL;
              // Lo que escribio la IA se presenta como tal: el cliente no
              // debe creer que le ha contestado una persona.
              const isAi = message.source === MESSAGE_SOURCES.AI;

              return (
                <div
                  key={message.id}
                  className={cn('flex gap-3', isMine ? 'flex-row-reverse' : 'flex-row')}
                >
                  <Avatar className="mt-0.5 size-8 shrink-0">
                    <AvatarFallback>
                      {isMine ? 'TU' : isAi ? 'IA' : getInitials(message.author?.name ?? 'CONIT')}
                    </AvatarFallback>
                  </Avatar>

                  <div
                    className={cn(
                      'flex max-w-[42rem] min-w-0 flex-col gap-1.5 rounded-xl border px-4 py-3',
                      isMine ? 'border-primary/20 bg-primary/[0.07]' : 'border-border bg-card',
                    )}
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-xs font-semibold text-foreground">
                        {isMine
                          ? 'Tu'
                          : isAi
                            ? 'Asistente virtual de CONIT'
                            : (message.author?.name ?? 'Soporte CONIT')}
                      </span>
                      {isAi ? (
                        <span className="text-[0.6875rem] text-muted-foreground">
                          respuesta automatica
                        </span>
                      ) : null}
                      {message.source === MESSAGE_SOURCES.EMAIL ? (
                        <span className="text-[0.6875rem] text-muted-foreground">por correo</span>
                      ) : null}
                      <time
                        dateTime={message.createdAt}
                        className="tabular text-xs text-muted-foreground"
                      >
                        {moment(message.createdAt)}
                      </time>
                    </div>

                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                      {message.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Separator className="my-2" />

        <form onSubmit={send} className="flex flex-col gap-3">
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            maxLength={5000}
            placeholder="Escribe aqui si quieres anadir informacion o preguntarnos algo…"
            aria-label="Nuevo mensaje"
          />

          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              {ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'
                ? 'Si escribes, volveremos a abrir la incidencia.'
                : 'Te responderemos por aqui y tambien por correo.'}
            </p>

            <Button
              type="submit"
              disabled={body.trim().length === 0}
              loading={addMessage.isPending}
              loadingText="Enviando…"
            >
              <SendIcon />
              Enviar
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
