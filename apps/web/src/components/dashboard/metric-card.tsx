'use client';

import { type DashboardMetric,TICKET_STATUSES } from '@conit/types';
import { Card, cn } from '@conit/ui';
import {
  CircleAlertIcon,
  CircleCheckIcon,
  ClockIcon,
  LoaderIcon,
  type LucideIcon,
  TicketIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from 'lucide-react';

type MetricKey = DashboardMetric['key'];

/** Etiqueta, icono y color de cada metrica de cabecera. */
const METRIC_META: Record<MetricKey, { label: string; icon: LucideIcon; tone: string }> = {
  [TICKET_STATUSES.NEW]: {
    label: 'Tickets nuevos',
    icon: TicketIcon,
    tone: 'bg-primary/10 text-primary',
  },
  [TICKET_STATUSES.IN_REVIEW]: {
    label: 'En revision',
    icon: ClockIcon,
    tone: 'bg-info/12 text-info',
  },
  [TICKET_STATUSES.IN_PROGRESS]: {
    label: 'En proceso',
    icon: LoaderIcon,
    tone: 'bg-warning/14 text-warning',
  },
  [TICKET_STATUSES.RESOLVED]: {
    label: 'Resueltos',
    icon: CircleCheckIcon,
    tone: 'bg-success/12 text-success',
  },
  [TICKET_STATUSES.CLOSED]: {
    label: 'Cerrados',
    icon: CircleCheckIcon,
    tone: 'bg-muted text-muted-foreground',
  },
  CRITICAL: {
    label: 'Criticos abiertos',
    icon: CircleAlertIcon,
    tone: 'bg-destructive/12 text-destructive',
  },
};

/**
 * Tarjeta de metrica.
 *
 * La variacion solo se muestra cuando la API la envia. Para las colas
 * intermedias no existe una base de comparacion fiable sin historico, y la
 * alternativa —inventar un porcentaje— seria peor que no mostrar nada.
 */
export function MetricCard({ metric }: { metric: DashboardMetric }) {
  const meta = METRIC_META[metric.key];
  const Icon = meta.icon;
  const isPositive = metric.delta !== null && metric.delta >= 0;
  const TrendIcon = isPositive ? TrendingUpIcon : TrendingDownIcon;

  return (
    <Card className="gap-0 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="truncate text-xs font-medium tracking-[0.04em] text-muted-foreground uppercase">
            {meta.label}
          </p>
          <p className="tabular text-3xl leading-none font-semibold">{metric.value}</p>
        </div>

        <span
          className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', meta.tone)}
        >
          <Icon className="size-4.5" aria-hidden="true" />
        </span>
      </div>

      <div className="mt-4 flex items-center gap-1.5 text-xs">
        {metric.delta === null ? (
          <span className="text-muted-foreground">Cola actual</span>
        ) : (
          <>
            <TrendIcon
              className={cn('size-3.5', isPositive ? 'text-success' : 'text-muted-foreground')}
              aria-hidden="true"
            />
            <span
              className={cn('tabular font-medium', isPositive ? 'text-success' : 'text-foreground')}
            >
              {isPositive ? '+' : ''}
              {metric.delta}%
            </span>
            <span className="text-muted-foreground">vs. 7 dias antes</span>
          </>
        )}
      </div>
    </Card>
  );
}
