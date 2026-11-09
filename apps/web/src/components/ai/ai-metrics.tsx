'use client';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@conit/ui';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { supportService } from '@/services/support.service';
const currency = (value: number | null | undefined) =>
  value == null ? '—' : `$${value.toFixed(4)}`;

export function AiMetrics() {
  const query = useQuery({
    queryKey: ['support-metrics'],
    queryFn: supportService.metrics,
    refetchInterval: 30_000,
  });
  if (query.isPending) return <p>Cargando métricas…</p>;
  if (query.isError)
    return (
      <p role="alert">
        No se pudieron leer las métricas.{' '}
        <Button variant="ghost" onClick={() => void query.refetch()}>
          Reintentar
        </Button>
      </p>
    );
  const data = query.data;
  const total = data.stages.reduce((sum, item) => sum + item._count, 0);
  const resolved = data.resolvedWithoutTicket;
  const stats = [
    ['Casos (30 días)', total],
    ['Resueltos sin ticket', total ? `${((100 * resolved) / total).toFixed(1)} %` : '—'],
    ['Turnos de IA', data.usage._count],
    ['Costo registrado (USD)', currency(data.usage._sum.cost)],
    [
      'Primera respuesta',
      data.firstResponseMs == null ? '—' : `${(data.firstResponseMs / 1000).toFixed(1)} s`,
    ],
    [
      'Satisfacción',
      data.satisfaction == null ? '—' : `${data.satisfaction.toFixed(1)} / 5 (${data.ratings})`,
    ],
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Supervisión de IA · últimos 30 días</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          {data.stages.map((item) => (
            <span key={item.stage}>
              {item.stage}: {item._count}
            </span>
          ))}
          <span>Buenas: {data.feedback.find((item) => item.feedback === 1)?._count ?? 0}</span>
          <span>Malas: {data.feedback.find((item) => item.feedback === -1)?._count ?? 0}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          El costo aparece cuando el proveedor lo informa o se configuraron tarifas. Los importes
          sin medición se muestran como —.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <caption className="mb-2 text-left font-semibold">Consumo por día (UTC)</caption>
            <thead>
              <tr>
                <th className="p-2">Día</th>
                <th>Turnos</th>
                <th>Errores</th>
                <th>USD</th>
              </tr>
            </thead>
            <tbody>
              {data.daily.map((day) => (
                <tr key={day.day} className="border-t border-border">
                  <td className="p-2">{day.day}</td>
                  <td>{day.turns}</td>
                  <td>{day.errors}</td>
                  <td>{currency(day.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <caption className="mb-2 text-left font-semibold">Últimos turnos</caption>
            <thead>
              <tr>
                <th className="p-2">Conversación</th>
                <th>Modelo</th>
                <th>Acción</th>
                <th>Herramientas</th>
                <th>Latencia</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((turn) => (
                <tr key={turn.id} className="border-t border-border">
                  <td className="p-2">
                    <Link
                      className="text-primary underline"
                      href={`/admin/bandeja?conversation=${turn.conversationId}`}
                    >
                      Abrir chat
                    </Link>
                  </td>
                  <td>{turn.model}</td>
                  <td>{turn.error ?? turn.action}</td>
                  <td>
                    {turn.tools
                      .map((tool) => `${tool.name}${tool.ok ? '' : ' (falló)'}`)
                      .join(', ') || '—'}
                  </td>
                  <td>{(turn.latencyMs / 1000).toFixed(1)} s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
