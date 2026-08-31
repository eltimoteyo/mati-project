'use client';

import type { DashboardMetric } from '@conit/types';
import { CardGridSkeleton } from '@conit/ui';
import { motion } from 'motion/react';

import { MetricCard } from './metric-card';

interface MetricsGridProps {
  metrics: DashboardMetric[];
  isLoading?: boolean;
}

/**
 * Rejilla de metricas del dashboard.
 *
 * La entrada escalonada guia la lectura de izquierda a derecha en el primer
 * pintado; el desplazamiento es minimo (6 px) para que resulte perceptible
 * sin llegar a distraer.
 */
export function MetricsGrid({ metrics, isLoading = false }: MetricsGridProps) {
  if (isLoading) {
    return <CardGridSkeleton items={5} className="xl:grid-cols-5" />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {metrics.map((metric, index) => (
        <motion.div
          key={metric.key}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
        >
          <MetricCard metric={metric} />
        </motion.div>
      ))}
    </div>
  );
}
