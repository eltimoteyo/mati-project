'use client';

import type { TicketVolumePoint } from '@conit/types';
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from '@conit/ui';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChartColumnIcon } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ChartTooltip } from '@/components/domain/chart-tooltip';

interface TicketsChartProps {
  data: TicketVolumePoint[];
  isLoading?: boolean;
  className?: string;
}

const SERIES = [
  { key: 'created', label: 'Creados', color: 'var(--color-chart-1)' },
  { key: 'resolved', label: 'Resueltos', color: 'var(--color-chart-4)' },
] as const;

/** Etiqueta corta del eje: "25 ago". */
function shortDate(value: string): string {
  return format(parseISO(value), 'd MMM', { locale: es });
}

/**
 * Evolucion diaria de tickets creados frente a resueltos.
 *
 * Comparar ambas series de un vistazo responde a la pregunta operativa clave:
 * si el equipo resuelve al ritmo al que entran incidencias.
 */
export function TicketsChart({ data, isLoading = false, className }: TicketsChartProps) {
  const hasData = data.some((point) => point.created > 0 || point.resolved > 0);

  return (
    <Card className={className}>
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle>Volumen de tickets</CardTitle>
        <div className="flex items-center gap-4 pt-1">
          {SERIES.map((series) => (
            <span key={series.key} className="flex items-center gap-1.5 text-xs">
              <span
                aria-hidden="true"
                className="size-2 rounded-full"
                style={{ backgroundColor: series.color }}
              />
              <span className="text-muted-foreground">{series.label}</span>
            </span>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">Ultimos 14 dias</span>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : !hasData ? (
          <EmptyState
            icon={ChartColumnIcon}
            title="Sin actividad en el periodo"
            description="Cuando se registren o resuelvan tickets, la evolucion aparecera aqui."
            className="py-16"
          />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                <defs>
                  {SERIES.map((series) => (
                    <linearGradient
                      key={series.key}
                      id={`fill-${series.key}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={series.color} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={series.color} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>

                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  minTickGap={24}
                  tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
                />
                <Tooltip
                  content={<ChartTooltip series={SERIES} />}
                  cursor={{ stroke: 'var(--color-border)' }}
                />

                {SERIES.map((series) => (
                  <Area
                    key={series.key}
                    type="monotone"
                    dataKey={series.key}
                    stroke={series.color}
                    strokeWidth={2}
                    fill={`url(#fill-${series.key})`}
                    dot={false}
                    activeDot={{ r: 3.5, strokeWidth: 0 }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
