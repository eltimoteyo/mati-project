'use client';

import { type SupportAgent,USER_STATUSES } from '@conit/types';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  EmptyState,
  ErrorState,
  getInitials,
  Skeleton,
} from '@conit/ui';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import { es } from 'date-fns/locale';
import { HeadphonesIcon, TriangleAlertIcon, UserPlusIcon } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/common/page-header';
import { useIsHydrated } from '@/hooks/use-is-hydrated';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

interface SupportTeamResponse {
  agents: SupportAgent[];
  unassigned: number;
}

function useSupportTeam() {
  return useQuery({
    queryKey: [...queryKeys.users.all, 'team'] as const,
    queryFn: () => apiClient.get<SupportTeamResponse>('/users/team'),
    staleTime: 60_000,
  });
}

/** Cifra de la tarjeta de un agente. */
function Stat({ label, value, tone }: { label: string; value: number; tone?: 'danger' }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          'tabular text-2xl leading-none font-semibold',
          tone === 'danger' && value > 0 && 'text-destructive',
        )}
      >
        {value}
      </span>
    </div>
  );
}

function AgentCard({ agent }: { agent: SupportAgent }) {
  const isHydrated = useIsHydrated();
  const isActive = agent.status === USER_STATUSES.ACTIVE;

  return (
    <Card className="gap-0 p-5">
      <div className="flex items-start gap-3">
        <Avatar className="size-10">
          {agent.avatar ? <AvatarImage src={agent.avatar} alt="" /> : null}
          <AvatarFallback>{getInitials(agent.name)}</AvatarFallback>
        </Avatar>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-medium text-foreground">{agent.name}</span>
          <span className="truncate text-xs text-muted-foreground">{agent.email}</span>
        </div>

        <Badge variant={isActive ? 'success' : 'neutral'}>
          {isActive ? 'Activo' : 'Inactivo'}
        </Badge>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-4 border-t border-border pt-4">
        <Stat label="Abiertos" value={agent.workload.open} />
        <Stat label="Criticos" value={agent.workload.critical} tone="danger" />
        <Stat label="Resueltos (30 d)" value={agent.workload.resolvedLast30Days} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="tabular">{agent.workload.total} asignados en total</span>
        {/* La antiguedad relativa se calcula tras la hidratacion: servidor y
            navegador renderizan en instantes distintos. */}
        <span className="tabular">
          {isHydrated && agent.lastLoginAt
            ? `activo hace ${formatDistanceToNowStrict(new Date(agent.lastLoginAt), { locale: es })}`
            : ''}
        </span>
      </div>

      {agent.workload.open > 0 ? (
        <Button asChild variant="outline" size="sm" className="mt-4" block>
          <Link href={`/admin/tickets?assigneeId=${agent.id}`}>Ver sus tickets</Link>
        </Button>
      ) : null}
    </Card>
  );
}

/**
 * Equipo de soporte.
 *
 * Muestra el reparto real de la carga a partir de los tickets asignados. No
 * gestiona altas de usuario: crear cuentas es administracion de accesos y
 * llegara con su propio modulo.
 */
export function SupportTeamView() {
  const query = useSupportTeam();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Encargado de soporte"
        description="Reparto de la carga de trabajo entre el equipo."
      />

      {query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-56 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {/* Los tickets abiertos sin responsable son el hueco que el equipo
              debe cubrir; se destacan antes que cualquier otra cifra. */}
          {query.data.unassigned > 0 ? (
            <Card className="border-warning/30 bg-warning/8">
              <CardHeader className="items-center">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-warning/15 text-warning">
                    <TriangleAlertIcon className="size-4.5" aria-hidden="true" />
                  </span>
                  <div className="flex flex-col">
                    <CardTitle>
                      {query.data.unassigned} ticket(s) abiertos sin responsable
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Nadie los esta atendiendo todavia.
                    </p>
                  </div>
                </div>
                <Button asChild size="sm">
                  <Link href="/admin/tickets?status=NEW">
                    <UserPlusIcon />
                    Asignar
                  </Link>
                </Button>
              </CardHeader>
            </Card>
          ) : null}

          {query.data.agents.length === 0 ? (
            <Card>
              <EmptyState
                icon={HeadphonesIcon}
                title="No hay personal de soporte"
                description="Los usuarios con rol de administrador apareceran aqui con su carga de trabajo."
              />
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {query.data.agents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          )}

          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle>Sobre este modulo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                En esta fase el equipo de soporte son los usuarios con rol de administrador. La
                gestion de cuentas —alta, baja y cambio de rol— pertenece al modulo de
                administracion de accesos, que aun no esta desarrollado.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
