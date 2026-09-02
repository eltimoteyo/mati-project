'use client';

import {
  type Notification,
  NOTIFICATION_TYPE_DESCRIPTIONS,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPES,
  type NotificationType,
} from '@conit/types';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  EmptyState,
  ErrorState,
  Pagination,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Switch,
} from '@conit/ui';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangleIcon,
  BellOffIcon,
  CheckCheckIcon,
  CircleDotIcon,
  type LucideIcon,
  MessageSquareIcon,
  UserPlusIcon,
  XIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/common/page-header';
import {
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationPreferences,
  useNotifications,
  useSetNotificationPreference,
  useUnreadCount,
} from '@/hooks/use-notifications';

const TYPE_ICONS: Record<NotificationType, LucideIcon> = {
  TICKET_ASSIGNED: UserPlusIcon,
  TICKET_STATUS_CHANGED: CircleDotIcon,
  TICKET_MESSAGE: MessageSquareIcon,
  TICKET_CRITICAL: AlertTriangleIcon,
};

function NotificationItem({ notification }: { notification: Notification }) {
  const markRead = useMarkNotificationRead();
  const remove = useDeleteNotification();

  const Icon = TYPE_ICONS[notification.type] ?? CircleDotIcon;
  const isUnread = notification.readAt === null;
  const isCritical = notification.type === NOTIFICATION_TYPES.TICKET_CRITICAL;

  return (
    <li
      className={cn(
        'flex items-start gap-3 rounded-lg border px-4 py-3.5 transition-colors',
        isUnread ? 'border-primary/20 bg-primary/[0.04]' : 'border-border bg-card',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border',
          isCritical
            ? 'border-danger/25 bg-danger/10 text-danger'
            : 'border-border bg-muted/40 text-muted-foreground',
        )}
      >
        <Icon className="size-3.5" aria-hidden="true" />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span
            className={cn('text-sm', isUnread ? 'font-medium text-foreground' : 'text-foreground/80')}
          >
            {notification.title}
          </span>
          <span className="text-xs text-muted-foreground">
            {NOTIFICATION_TYPE_LABELS[notification.type]}
          </span>
        </div>

        {notification.ticket ? (
          <Link
            href={`/admin/tickets/${notification.ticket.code}`}
            onClick={() => {
              if (isUnread) markRead.mutate(notification.id);
            }}
            className="w-fit rounded-sm text-sm text-muted-foreground hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/22"
          >
            {notification.body}
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">{notification.body}</span>
        )}

        <time dateTime={notification.createdAt} className="tabular text-xs text-muted-foreground/80">
          {format(new Date(notification.createdAt), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
        </time>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {isUnread ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Marcar como leida"
            disabled={markRead.isPending}
            onClick={() => markRead.mutate(notification.id)}
          >
            <CheckCheckIcon />
          </Button>
        ) : null}

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Descartar"
          disabled={remove.isPending}
          onClick={() => remove.mutate(notification.id)}
        >
          <XIcon />
        </Button>
      </div>
    </li>
  );
}

/** Preferencias por tipo de aviso. */
function PreferencesCard() {
  const preferences = useNotificationPreferences();
  const setPreference = useSetNotificationPreference();

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle>Preferencias</CardTitle>
        <p className="text-sm text-muted-foreground">
          Elige que avisos quieres recibir dentro de la aplicacion.
        </p>
      </CardHeader>

      <CardContent>
        {preferences.isPending ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {(preferences.data ?? []).map((preference) => (
              <li
                key={preference.type}
                className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">
                    {NOTIFICATION_TYPE_LABELS[preference.type]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {NOTIFICATION_TYPE_DESCRIPTIONS[preference.type]}
                  </span>
                </div>

                <Switch
                  checked={preference.enabled}
                  disabled={setPreference.isPending}
                  aria-label={NOTIFICATION_TYPE_LABELS[preference.type]}
                  onCheckedChange={(enabled) =>
                    setPreference.mutate({ type: preference.type, enabled })
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Notificaciones.
 *
 * Reune el historial y las preferencias: quien viene a revisar los avisos es
 * quien mas probablemente quiera ajustar cuales recibe.
 */
export function NotificationsView() {
  const [page, setPage] = useState(1);
  const [scope, setScope] = useState('all');
  const [type, setType] = useState('');

  const count = useUnreadCount();
  const markAllRead = useMarkAllNotificationsRead();

  const filters = useMemo(
    () => ({
      page,
      unreadOnly: scope === 'unread' ? true : undefined,
      type: (type || undefined) as NotificationType | undefined,
    }),
    [page, scope, type],
  );

  const query = useNotifications(filters);
  const notifications = query.data?.items ?? [];
  const unread = count.data?.unread ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notificaciones"
        description={
          unread > 0
            ? `Tienes ${unread} ${unread === 1 ? 'aviso sin leer' : 'avisos sin leer'}.`
            : 'Avisos sobre tus tickets y conversaciones.'
        }
        actions={
          unread > 0 ? (
            <Button
              variant="outline"
              loading={markAllRead.isPending}
              loadingText="Marcando…"
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheckIcon />
              Marcar todas como leidas
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={scope}
              onValueChange={(value) => {
                setScope(value);
                setPage(1);
              }}
            >
              <SelectTrigger size="sm" className="w-40" aria-label="Filtrar por estado de lectura">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="unread">Sin leer</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={type || 'all'}
              onValueChange={(value) => {
                setType(value === 'all' ? '' : value);
                setPage(1);
              }}
            >
              <SelectTrigger size="sm" className="w-52" aria-label="Filtrar por tipo de aviso">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {Object.values(NOTIFICATION_TYPES).map((value) => (
                  <SelectItem key={value} value={value}>
                    {NOTIFICATION_TYPE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {query.isError ? (
            <ErrorState onRetry={() => void query.refetch()} />
          ) : query.isPending ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <EmptyState
              icon={BellOffIcon}
              title={scope === 'unread' ? 'Nada sin leer' : 'No tienes notificaciones'}
              description={
                scope === 'unread'
                  ? 'Estas al dia con todos tus avisos.'
                  : 'Los avisos sobre tickets asignados, cambios de estado y mensajes apareceran aqui.'
              }
            />
          ) : (
            <>
              <ul className="flex flex-col gap-3">
                {notifications.map((notification) => (
                  <NotificationItem key={notification.id} notification={notification} />
                ))}
              </ul>

              {query.data ? (
                <Pagination meta={query.data.meta} onPageChange={setPage} itemLabel="avisos" />
              ) : null}
            </>
          )}
        </div>

        <PreferencesCard />
      </div>
    </div>
  );
}
