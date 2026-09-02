'use client';

import type { PortalTicket } from '@conit/types';
import { Card, CardContent, cn, EmptyState, ErrorState, Separator, Skeleton } from '@conit/ui';
import { formatDistanceToNowStrict } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowRightIcon,
  BuildingIcon,
  CheckCircle2Icon,
  ClockIcon,
  MailIcon,
  PhoneIcon,
  TicketIcon,
} from 'lucide-react';
import Link from 'next/link';

import { useIsHydrated } from '@/hooks/use-is-hydrated';
import { usePortalProfile, usePortalTickets } from '@/hooks/use-portal';

import { PortalStatusBadge } from './portal-status';

function Relative({ value }: { value: string }) {
  const isHydrated = useIsHydrated();

  if (!isHydrated) return <span className="text-muted-foreground">—</span>;

  return (
    <span className="whitespace-nowrap text-muted-foreground">
      hace {formatDistanceToNowStrict(new Date(value), { locale: es })}
    </span>
  );
}

/** Fila de una incidencia en el resumen. */
export function PortalTicketRow({ ticket }: { ticket: PortalTicket }) {
  return (
    <Link
      href={`/portal/incidencias/${ticket.code}`}
      className="group flex flex-col gap-2 rounded-xl border border-border/80 bg-card/90 px-4 py-3.5 shadow-subtle transition-[border-color,background-color,box-shadow] hover:border-primary/35 hover:bg-card hover:shadow-raised focus-visible:ring-[3px] focus-visible:ring-ring/20 focus-visible:outline-none sm:flex-row sm:items-center sm:gap-4"
    >
      <span className="tabular shrink-0 font-mono text-xs font-semibold text-primary">
        {ticket.code}
      </span>

      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground group-hover:text-primary">
        {ticket.subject}
      </span>

      <div className="flex items-center gap-3">
        <PortalStatusBadge status={ticket.status} />
        <span className="hidden text-xs sm:inline">
          <Relative value={ticket.updatedAt} />
        </span>
      </div>
    </Link>
  );
}

interface StatProps {
  label: string;
  value: number;
  hint: string;
  icon: typeof TicketIcon;
  isLoading: boolean;
  /** Resalta la cifra cuando es la que exige atencion. */
  highlight?: boolean;
}

function Stat({ label, value, hint, icon: Icon, isLoading, highlight = false }: StatProps) {
  return (
    <Card
      className={cn(
        'border-border/80 bg-card/90 shadow-subtle',
        highlight && value > 0 ? 'border-warning/35 bg-warning/[0.055]' : undefined,
      )}
    >
      <CardContent className="flex items-start gap-3 py-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/[0.07] text-primary">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs font-medium tracking-[0.04em] text-muted-foreground uppercase">
            {label}
          </span>
          {isLoading ? (
            <Skeleton className="h-7 w-10" />
          ) : (
            <span className="tabular text-2xl font-semibold text-foreground">{value}</span>
          )}
          <span className="text-xs text-muted-foreground">{hint}</span>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Inicio del portal.
 *
 * Responde de arriba abajo a lo que trae aqui a un cliente: cuantas cosas
 * tengo abiertas, en que van, y como abro una nueva.
 */
export function PortalHome() {
  const profile = usePortalProfile();
  const recent = usePortalTickets({ pageSize: 5 });

  if (profile.isError) {
    return <ErrorState onRetry={() => void profile.refetch()} />;
  }

  const counts = profile.data?.counts;
  const client = profile.data?.client;
  const tickets = recent.data?.items ?? [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {profile.data ? `Hola, ${profile.data.user.name.split(' ')[0]}` : 'Hola'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Aqui puedes reportar una incidencia y seguir como avanza.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Abiertas"
          value={counts?.open ?? 0}
          hint="En curso ahora mismo"
          icon={TicketIcon}
          isLoading={profile.isPending}
        />
        <Stat
          label="Sin respuesta"
          value={counts?.awaitingResponse ?? 0}
          hint="Aun no las hemos contestado"
          icon={ClockIcon}
          isLoading={profile.isPending}
          highlight
        />
        <Stat
          label="Resueltas"
          value={counts?.resolved ?? 0}
          hint="Cerradas con solucion"
          icon={CheckCircle2Icon}
          isLoading={profile.isPending}
        />
      </div>

      {/* Actividad reciente ------------------------------------------------ */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-foreground">Ultimas incidencias</h2>
          {tickets.length > 0 ? (
            <Link
              href="/portal/incidencias"
              className="group inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline"
            >
              Ver todas
              <ArrowRightIcon
                className="size-3.5 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          ) : null}
        </div>

        {recent.isError ? (
          <ErrorState onRetry={() => void recent.refetch()} />
        ) : recent.isPending ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <EmptyState
            icon={TicketIcon}
            title="Aun no has reportado nada"
            description="Cuando tengas una incidencia, registrala y podras seguirla desde aqui."
            className="rounded-xl border border-border/80 bg-card/90 py-14 shadow-subtle"
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {tickets.map((ticket) => (
              <PortalTicketRow key={ticket.id} ticket={ticket} />
            ))}
          </div>
        )}
      </section>

      {/* Ficha de la empresa ------------------------------------------------ */}
      {client ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-foreground">Tus datos</h2>

          <Card className="border-border/80 bg-card/90 shadow-subtle">
            <CardContent className="flex flex-col gap-4 py-5">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/[0.07] text-primary">
                  <BuildingIcon className="size-4" aria-hidden="true" />
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium text-foreground">{client.name}</span>
                  {client.taxId ? (
                    <span className="tabular text-xs text-muted-foreground">
                      RUC {client.taxId}
                    </span>
                  ) : null}
                </div>
              </div>

              <Separator />

              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MailIcon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{client.email}</span>
                </div>
                {client.phone ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <PhoneIcon className="size-4 shrink-0" aria-hidden="true" />
                    {client.phone}
                  </div>
                ) : null}
              </dl>

              {(profile.data?.services.length ?? 0) > 0 ? (
                <>
                  <Separator />
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-medium tracking-[0.04em] text-muted-foreground uppercase">
                      Servicios contratados
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(profile.data?.services ?? []).map((service) => (
                        <span
                          key={service.id}
                          className="rounded-md border border-border bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground"
                        >
                          {service.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}

              <p className="text-xs text-muted-foreground">
                Si algun dato no es correcto, escribenos y lo corregimos.
              </p>
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
