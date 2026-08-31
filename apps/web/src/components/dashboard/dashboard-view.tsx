'use client';

import { Badge, Button, ErrorState } from '@conit/ui';
import { PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { PageHeader } from '@/components/common/page-header';
import { TicketFormDialog } from '@/components/tickets/ticket-form-dialog';
import { useDashboardSummary } from '@/hooks/use-dashboard';

import { ActivityTable } from './activity-table';
import { MetricsGrid } from './metrics-grid';
import { ServiceDistribution } from './service-distribution';
import { TicketsChart } from './tickets-chart';

/**
 * Dashboard administrativo.
 *
 * Todas las cifras provienen de `GET /dashboard/summary`, que las agrega en el
 * servidor en una sola peticion. No hay datos de ejemplo: si no hay tickets,
 * las vistas muestran su estado vacio.
 */
export function DashboardView() {
  const query = useDashboardSummary();
  const [formOpen, setFormOpen] = useState(false);

  if (query.isError) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Dashboard" />
        <ErrorState
          title="No pudimos cargar el resumen"
          description="El servidor no respondio. Puedes reintentarlo."
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }

  const summary = query.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="Estado general de las incidencias y la actividad reciente de soporte."
        actions={
          <div className="flex items-center gap-2">
            {summary ? (
              <Badge variant="neutral">
                {summary.totals.clients} clientes · {summary.totals.projects} servicios
              </Badge>
            ) : null}
            <Button onClick={() => setFormOpen(true)}>
              <PlusIcon />
              Nuevo ticket
            </Button>
          </div>
        }
      />

      <MetricsGrid metrics={summary?.metrics ?? []} isLoading={query.isPending} />

      <div className="grid gap-4 xl:grid-cols-3">
        <TicketsChart
          data={summary?.volume ?? []}
          isLoading={query.isPending}
          className="xl:col-span-2"
        />
        <ServiceDistribution items={summary?.distribution ?? []} isLoading={query.isPending} />
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold tracking-[-0.01em]">Actividad reciente</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/tickets">Ver todos los tickets</Link>
          </Button>
        </div>

        <ActivityTable rows={summary?.recentTickets ?? []} isLoading={query.isPending} />
      </section>

      <TicketFormDialog open={formOpen} onOpenChange={setFormOpen} navigateOnCreate />
    </div>
  );
}
