'use client';

import {
  SERVICE_TYPE_LABELS,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_TRANSITIONS,
  type TicketPriority,
  type TicketStatus,
} from '@conit/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorState,
  PageLoader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Skeleton,
} from '@conit/ui';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeftIcon, ExternalLinkIcon, PencilIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { PageHeader } from '@/components/common/page-header';
import {
  CategoryBadge,
  TicketPriorityBadge,
  TicketStatusBadge,
} from '@/components/domain/badges';
import { useSession } from '@/hooks/use-session';
import { useTicket, useUpdateTicket } from '@/hooks/use-tickets';

import { TicketConversation } from './ticket-conversation';
import { TicketFormDialog } from './ticket-form-dialog';
import { TicketTimeline } from './ticket-timeline';

/** Fila de metadato en la barra lateral. */
function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="text-xs font-medium tracking-[0.04em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function formatDate(value: string | null): string {
  if (!value) return '—';

  return format(new Date(value), "d MMM yyyy, HH:mm", { locale: es });
}

export function TicketDetailView({ code }: { code: string }) {
  const query = useTicket(code);
  const { user } = useSession();
  const updateMutation = useUpdateTicket();
  const [editOpen, setEditOpen] = useState(false);

  if (query.isPending) {
    return <PageLoader message="Cargando ticket…" />;
  }

  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="No pudimos cargar el ticket"
        description="Puede que el codigo no exista o que el servidor no responda."
        onRetry={() => void query.refetch()}
      />
    );
  }

  const ticket = query.data;
  const allowedTransitions = TICKET_STATUS_TRANSITIONS[ticket.status];

  const changeStatus = (status: TicketStatus) => {
    updateMutation.mutate({ idOrCode: ticket.id, input: { status } });
  };

  const changePriority = (priority: TicketPriority) => {
    updateMutation.mutate({ idOrCode: ticket.id, input: { priority } });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Button asChild variant="ghost" size="sm" className="w-fit -ml-2">
          <Link href="/admin/tickets">
            <ArrowLeftIcon />
            Volver a tickets
          </Link>
        </Button>

        <PageHeader
          title={ticket.subject}
          description={`${ticket.code} · registrado el ${formatDate(ticket.createdAt)}`}
          actions={
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <PencilIcon />
              Editar
            </Button>
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          <TicketStatusBadge status={ticket.status} />
          <TicketPriorityBadge priority={ticket.priority} />
          <CategoryBadge category={ticket.category} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ------------------------------------------------------------------ */}
        {/* Columna principal                                                    */}
        {/* ------------------------------------------------------------------ */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Descripcion</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                {ticket.description}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle>Conversacion</CardTitle>
              <p className="text-sm text-muted-foreground">
                Respuestas al cliente y notas internas del equipo, en un mismo hilo.
              </p>
            </CardHeader>
            <CardContent>
              <TicketConversation
                idOrCode={ticket.id}
                messages={ticket.messages}
                currentUser={user}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <div className="flex w-full items-center justify-between gap-3">
                <CardTitle>Historial de cambios</CardTitle>
                <Badge variant="neutral">{ticket.events.length}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Auditoria de estado, prioridad, categoria y asignacion.
              </p>
            </CardHeader>
            <CardContent>
              {updateMutation.isPending ? (
                <div className="flex flex-col gap-3 pb-3">
                  <Skeleton shape="text" className="w-2/3" />
                  <Skeleton shape="text" className="w-1/3" />
                </div>
              ) : null}
              <TicketTimeline events={ticket.events} />
            </CardContent>
          </Card>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Barra lateral                                                        */}
        {/* ------------------------------------------------------------------ */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Gestion</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="ticket-status"
                  className="text-xs font-medium tracking-[0.04em] text-muted-foreground uppercase"
                >
                  Estado
                </label>
                <Select
                  value={ticket.status}
                  onValueChange={(value) => changeStatus(value as TicketStatus)}
                  disabled={updateMutation.isPending}
                >
                  <SelectTrigger id="ticket-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* El estado actual se muestra deshabilitado y solo se
                        ofrecen las transiciones que la API acepta. */}
                    <SelectItem value={ticket.status} disabled>
                      {TICKET_STATUS_LABELS[ticket.status]} (actual)
                    </SelectItem>
                    {allowedTransitions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {TICKET_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="ticket-priority"
                  className="text-xs font-medium tracking-[0.04em] text-muted-foreground uppercase"
                >
                  Prioridad
                </label>
                <Select
                  value={ticket.priority}
                  onValueChange={(value) => changePriority(value as TicketPriority)}
                  disabled={updateMutation.isPending}
                >
                  <SelectTrigger id="ticket-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(TICKET_PRIORITIES).map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {TICKET_PRIORITY_LABELS[priority]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalles</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-4">
                <MetaRow label="Cliente">
                  <Link
                    href={`/admin/tickets?clientId=${ticket.client.id}`}
                    className="rounded-sm font-medium hover:text-primary hover:underline"
                  >
                    {ticket.client.name}
                  </Link>
                </MetaRow>

                <MetaRow label="Servicio afectado">
                  {ticket.project ? (
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{ticket.project.name}</span>
                      <Badge variant="outline">{SERVICE_TYPE_LABELS[ticket.project.type]}</Badge>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Sin especificar</span>
                  )}
                </MetaRow>

                <MetaRow label="Responsable">
                  {ticket.assignee ? (
                    <span className="font-medium">{ticket.assignee.name}</span>
                  ) : (
                    <span className="text-muted-foreground">Sin asignar</span>
                  )}
                </MetaRow>

                <Separator />

                <MetaRow label="Primera respuesta">
                  <span className="tabular text-muted-foreground">
                    {formatDate(ticket.firstResponseAt)}
                  </span>
                </MetaRow>

                <MetaRow label="Resuelto">
                  <span className="tabular text-muted-foreground">
                    {formatDate(ticket.resolvedAt)}
                  </span>
                </MetaRow>

                <MetaRow label="Cerrado">
                  <span className="tabular text-muted-foreground">
                    {formatDate(ticket.closedAt)}
                  </span>
                </MetaRow>

                <Separator />

                <MetaRow label="Registrado por">
                  <span className="text-muted-foreground">
                    {ticket.createdBy?.name ?? 'Sistema'}
                  </span>
                </MetaRow>
              </dl>
            </CardContent>
          </Card>

          {ticket.project?.url ? (
            <Button asChild variant="outline" block>
              <a href={ticket.project.url} target="_blank" rel="noreferrer noopener">
                Abrir servicio
                <ExternalLinkIcon />
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      <TicketFormDialog open={editOpen} onOpenChange={setEditOpen} ticket={ticket} />
    </div>
  );
}
