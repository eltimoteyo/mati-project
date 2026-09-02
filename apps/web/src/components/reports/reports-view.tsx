'use client';

import {
  type ReportNamedCount,
  type ReportSummary,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
} from '@conit/types';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@conit/ui';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChartColumnIcon, DownloadIcon, UsersIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { PageHeader } from '@/components/common/page-header';
import { ChartTooltip } from '@/components/domain/chart-tooltip';
import { useCategoryOptions } from '@/hooks/use-categories';
import { useClientOptions } from '@/hooks/use-clients';
import { useExportReport, useReport } from '@/hooks/use-reports';

/** Rangos rapidos. El valor es el numero de dias hacia atras. */
const RANGES = [
  { value: '7', label: 'Ultimos 7 dias' },
  { value: '30', label: 'Ultimos 30 dias' },
  { value: '90', label: 'Ultimos 90 dias' },
  { value: 'custom', label: 'Personalizado' },
] as const;

const SERIES = [
  { key: 'created', label: 'Creados', color: 'var(--color-chart-1)' },
  { key: 'resolved', label: 'Resueltos', color: 'var(--color-chart-4)' },
] as const;

function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - (days - 1));

  return toDateInput(date);
}

/**
 * Duracion legible a partir de minutos.
 *
 * `null` se muestra como raya: significa "no se pudo medir", no "cero".
 */
function formatDuration(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours < 24) return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;

  const days = Math.floor(hours / 24);

  return `${days} d ${hours % 24} h`;
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${value} %`;
}

interface MetricProps {
  label: string;
  value: string;
  hint: string;
  isLoading: boolean;
}

function Metric({ label, value, hint, isLoading }: MetricProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5 py-5">
        <span className="text-xs font-medium tracking-[0.04em] text-muted-foreground uppercase">
          {label}
        </span>
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <span className="tabular text-2xl font-semibold text-foreground">{value}</span>
        )}
        <span className="text-xs text-muted-foreground">{hint}</span>
      </CardContent>
    </Card>
  );
}

/** Barra proporcional de un desglose. */
function BreakdownRow({ name, count, percentage }: { name: string; count: number; percentage: number }) {
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-foreground">{name}</span>
        <span className="tabular shrink-0 text-muted-foreground">
          {count} <span className="opacity-60">· {percentage} %</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary/70"
          style={{ width: `${Math.max(percentage, 1)}%` }}
        />
      </div>
    </li>
  );
}

function Breakdown({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: ReportNamedCount[];
  emptyLabel: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ul className="flex flex-col gap-3.5">
            {items.map((item) => (
              <BreakdownRow key={item.id} {...item} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function VolumeChart({ data }: { data: ReportSummary['volume'] }) {
  const hasData = data.some((point) => point.created > 0 || point.resolved > 0);

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle>Evolucion del periodo</CardTitle>
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
        </div>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                <defs>
                  {SERIES.map((series) => (
                    <linearGradient
                      key={series.key}
                      id={`report-fill-${series.key}`}
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
                  tickFormatter={(value: string) => format(parseISO(value), 'd MMM', { locale: es })}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  minTickGap={28}
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
                    fill={`url(#report-fill-${series.key})`}
                    dot={false}
                    activeDot={{ r: 3.5, strokeWidth: 0 }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState
            icon={ChartColumnIcon}
            title="Sin actividad en el periodo"
            description="Prueba a ampliar el rango de fechas."
            className="py-16"
          />
        )}
      </CardContent>
    </Card>
  );
}

function AgentTable({ agents }: { agents: ReportSummary['byAgent'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rendimiento por responsable</CardTitle>
      </CardHeader>
      <CardContent>
        {agents.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title="Sin tickets asignados"
            description="Nadie tuvo tickets asignados ni resueltos en este periodo."
            className="py-10"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2.5 font-medium text-muted-foreground">Responsable</th>
                  <th className="pb-2.5 text-right font-medium text-muted-foreground">Asignados</th>
                  <th className="pb-2.5 text-right font-medium text-muted-foreground">Resueltos</th>
                  <th className="pb-2.5 text-right font-medium text-muted-foreground">
                    Media de resolucion
                  </th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr key={agent.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 text-foreground">{agent.name}</td>
                    <td className="tabular py-2.5 text-right text-muted-foreground">
                      {agent.assigned}
                    </td>
                    <td className="tabular py-2.5 text-right text-muted-foreground">
                      {agent.resolved}
                    </td>
                    <td className="tabular py-2.5 text-right text-muted-foreground">
                      {formatDuration(agent.averageResolutionMinutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Reportes operativos.
 *
 * Todas las cifras salen de los datos reales del periodo. Donde no hay dato
 * suficiente se muestra una raya en lugar de un cero, para no dar por buena
 * una lectura que no se ha medido.
 */
export function ReportsView() {
  const [range, setRange] = useState<string>('30');
  const [from, setFrom] = useState(() => daysAgo(30));
  const [to, setTo] = useState(() => toDateInput(new Date()));
  const [clientId, setClientId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const clients = useClientOptions();
  const categories = useCategoryOptions();
  const exportMutation = useExportReport();

  const filters = useMemo(
    () => ({
      from,
      to,
      clientId: clientId || undefined,
      categoryId: categoryId || undefined,
    }),
    [from, to, clientId, categoryId],
  );

  const query = useReport(filters);
  const report = query.data;

  const applyRange = (value: string) => {
    setRange(value);

    if (value === 'custom') return;

    setFrom(daysAgo(Number(value)));
    setTo(toDateInput(new Date()));
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reportes"
        description="Volumen, tiempos de atencion y cumplimiento de objetivos."
        actions={
          <Button
            variant="outline"
            onClick={() => exportMutation.mutate(filters)}
            loading={exportMutation.isPending}
            loadingText="Generando…"
          >
            <DownloadIcon />
            Exportar CSV
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Select value={range} onValueChange={applyRange}>
          <SelectTrigger size="sm" className="w-44" aria-label="Rango de fechas">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={from}
          max={to}
          onChange={(event) => {
            setFrom(event.target.value);
            setRange('custom');
          }}
          aria-label="Desde"
          className="h-8 w-[9.5rem] text-sm"
        />
        <Input
          type="date"
          value={to}
          min={from}
          onChange={(event) => {
            setTo(event.target.value);
            setRange('custom');
          }}
          aria-label="Hasta"
          className="h-8 w-[9.5rem] text-sm"
        />

        <Select
          value={clientId || 'all'}
          onValueChange={(value) => setClientId(value === 'all' ? '' : value)}
        >
          <SelectTrigger size="sm" className="w-44" aria-label="Filtrar por cliente">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {(clients.data ?? []).map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={categoryId || 'all'}
          onValueChange={(value) => setCategoryId(value === 'all' ? '' : value)}
        >
          <SelectTrigger size="sm" className="w-44" aria-label="Filtrar por categoria">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorias</SelectItem>
            {(categories.data ?? []).map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Creados"
              value={String(report?.totals.created ?? 0)}
              hint="Tickets registrados en el periodo"
              isLoading={query.isPending}
            />
            <Metric
              label="Resueltos"
              value={String(report?.totals.resolved ?? 0)}
              hint="Cerrados dentro del periodo"
              isLoading={query.isPending}
            />
            <Metric
              label="Abiertos ahora"
              value={String(report?.totals.open ?? 0)}
              hint="Cola actual, sin acotar por fecha"
              isLoading={query.isPending}
            />
            <Metric
              label="Reabiertos"
              value={String(report?.totals.reopened ?? 0)}
              hint="Volvieron atras tras resolverse"
              isLoading={query.isPending}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Primera respuesta"
              value={formatDuration(report?.times.firstResponseMinutes ?? null)}
              hint="Media desde el alta"
              isLoading={query.isPending}
            />
            <Metric
              label="Resolucion"
              value={formatDuration(report?.times.resolutionMinutes ?? null)}
              hint="Media desde el alta"
              isLoading={query.isPending}
            />
            <Metric
              label="Respuesta en objetivo"
              value={formatPercent(report?.times.responseWithinTargetPct ?? null)}
              hint={
                report && report.times.measuredAgainstTarget === 0
                  ? 'Ninguna categoria fija objetivos'
                  : 'Segun el objetivo de la categoria'
              }
              isLoading={query.isPending}
            />
            <Metric
              label="Resolucion en objetivo"
              value={formatPercent(report?.times.resolutionWithinTargetPct ?? null)}
              hint={
                report && report.times.measuredAgainstTarget === 0
                  ? 'Ninguna categoria fija objetivos'
                  : 'Segun el objetivo de la categoria'
              }
              isLoading={query.isPending}
            />
          </div>

          {query.isPending ? (
            <Skeleton className="h-80 w-full rounded-xl" />
          ) : (
            <VolumeChart data={report?.volume ?? []} />
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Breakdown
              title="Por cliente"
              items={report?.byClient ?? []}
              emptyLabel="Sin tickets en el periodo."
            />
            <Breakdown
              title="Por categoria"
              items={report?.byCategory ?? []}
              emptyLabel="Sin tickets en el periodo."
            />
            <Breakdown
              title="Por estado"
              items={(report?.byStatus ?? []).map((row) => ({
                id: row.key,
                name: TICKET_STATUS_LABELS[row.key],
                count: row.count,
                percentage: row.percentage,
              }))}
              emptyLabel="Sin tickets en el periodo."
            />
            <Breakdown
              title="Por prioridad"
              items={(report?.byPriority ?? []).map((row) => ({
                id: row.key,
                name: TICKET_PRIORITY_LABELS[row.key],
                count: row.count,
                percentage: row.percentage,
              }))}
              emptyLabel="Sin tickets en el periodo."
            />
          </div>

          <AgentTable agents={report?.byAgent ?? []} />
        </>
      )}
    </div>
  );
}
