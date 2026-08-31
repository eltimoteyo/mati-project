'use client';

import { SERVICE_TYPE_LABELS, type ServiceDistributionItem } from '@conit/types';
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from '@conit/ui';
import { BoxesIcon } from 'lucide-react';

interface ServiceDistributionProps {
  items: ServiceDistributionItem[];
  isLoading?: boolean;
}

/**
 * Reparto de incidencias por tipo de servicio.
 *
 * Se representa con barras horizontales en lugar de un grafico circular: con
 * ocho categorias posibles, comparar longitudes es mucho mas preciso que
 * comparar sectores, y las etiquetas caben sin leyenda aparte.
 */
export function ServiceDistribution({ items, isLoading = false }: ServiceDistributionProps) {
  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle>Distribucion por servicio</CardTitle>
        <p className="text-sm text-muted-foreground">Tickets con servicio asignado.</p>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="flex flex-col gap-1.5">
                <Skeleton shape="text" className="w-2/3" />
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={BoxesIcon}
            title="Sin datos suficientes"
            description="Asocia los tickets a un servicio para ver su reparto."
            className="py-12"
          />
        ) : (
          <ul className="flex flex-col gap-3.5">
            {items.map((item) => (
              <li key={item.type} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm text-foreground/85">
                    {SERVICE_TYPE_LABELS[item.type]}
                  </span>
                  <span className="tabular text-sm font-medium">
                    {item.percentage}%
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      ({item.count})
                    </span>
                  </span>
                </div>
                <div
                  role="presentation"
                  className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-primary/70 transition-[width] duration-500 ease-[var(--ease-out-quint)]"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
