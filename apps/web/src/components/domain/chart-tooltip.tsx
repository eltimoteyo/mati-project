'use client';

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Tooltip de los graficos de series temporales.
 *
 * Se implementa a mano porque el de Recharts trae sus propios estilos en linea
 * y no sigue los tokens del design system: en modo oscuro quedaria un recuadro
 * blanco. Lo comparten el panel y los reportes para que se lean igual.
 */

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
}

interface TooltipPayloadEntry {
  dataKey?: string | number;
  value?: number | string;
  color?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number;
  series: readonly ChartSeries[];
}

export function ChartTooltip({ active, payload, label, series }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const heading =
    typeof label === 'string' ? format(parseISO(label), "d 'de' MMMM", { locale: es }) : '';

  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 shadow-overlay">
      {heading ? <p className="mb-1.5 text-xs font-medium text-muted-foreground">{heading}</p> : null}
      <ul className="flex flex-col gap-1">
        {payload.map((entry) => {
          const match = series.find((item) => item.key === entry.dataKey);

          return (
            <li key={String(entry.dataKey)} className="flex items-center gap-2 text-xs">
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{match?.label ?? entry.dataKey}</span>
              <span className="tabular ml-auto font-medium text-foreground">{entry.value}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
