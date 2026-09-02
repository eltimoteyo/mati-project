'use client';

import type { Notification } from '@conit/types';
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@conit/ui';
import { formatDistanceToNowStrict } from 'date-fns';
import { es } from 'date-fns/locale';
import { BellIcon, BellOffIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useIsHydrated } from '@/hooks/use-is-hydrated';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from '@/hooks/use-notifications';

/** Avisos mostrados en el desplegable; el resto quedan en la pagina. */
const PREVIEW_SIZE = 6;

function Ago({ value }: { value: string }) {
  const isHydrated = useIsHydrated();

  if (!isHydrated) return null;

  return (
    <span className="text-[0.7rem] text-muted-foreground/80">
      hace {formatDistanceToNowStrict(new Date(value), { locale: es })}
    </span>
  );
}

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: Notification;
  onOpen: (notification: Notification) => void;
}) {
  const isUnread = notification.readAt === null;

  const content = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          'mt-1.5 size-1.5 shrink-0 rounded-full',
          isUnread ? 'bg-primary' : 'bg-transparent',
        )}
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span
          className={cn(
            'truncate text-sm',
            isUnread ? 'font-medium text-foreground' : 'text-muted-foreground',
          )}
        >
          {notification.title}
        </span>
        <span className="truncate text-xs text-muted-foreground">{notification.body}</span>
        <Ago value={notification.createdAt} />
      </span>
    </>
  );

  const className =
    'flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none';

  // Con ticket asociado el aviso navega; sin el, solo se marca como leido.
  if (notification.ticket) {
    return (
      <li>
        <Link
          href={`/admin/tickets/${notification.ticket.code}`}
          onClick={() => onOpen(notification)}
          className={className}
        >
          {content}
        </Link>
      </li>
    );
  }

  return (
    <li>
      <button type="button" onClick={() => onOpen(notification)} className={className}>
        {content}
      </button>
    </li>
  );
}

/**
 * Campana de avisos.
 *
 * El listado solo se pide cuando el menu esta abierto; el indicador de no
 * leidas es una consulta aparte y mucho mas barata, que es la que se refresca
 * periodicamente.
 */
export function NotificationsMenu() {
  const [open, setOpen] = useState(false);

  const count = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const query = useNotifications({ pageSize: PREVIEW_SIZE });
  const notifications = open ? (query.data?.items ?? []) : [];

  const unread = count.data?.unread ?? 0;

  const handleOpen = (notification: Notification) => {
    setOpen(false);

    if (notification.readAt === null) {
      markRead.mutate(notification.id);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="relative"
              aria-label={
                unread > 0 ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'
              }
            >
              <BellIcon />
              {unread > 0 ? (
                <span
                  aria-hidden="true"
                  className="tabular absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] leading-4 font-medium text-primary-foreground"
                >
                  {unread > 9 ? '9+' : unread}
                </span>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Notificaciones</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-88 p-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <DropdownMenuLabel className="px-0 py-0 text-sm font-semibold text-foreground">
            Notificaciones
          </DropdownMenuLabel>

          {unread > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              Marcar todas
            </Button>
          ) : null}
        </div>

        <DropdownMenuSeparator className="mx-0 my-0" />

        {query.isPending && open ? (
          <div className="flex flex-col gap-3 p-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={BellOffIcon}
            title="No tienes notificaciones"
            description="Aqui apareceran los avisos sobre tus tickets y conversaciones."
            className="px-5 py-10"
          />
        ) : (
          <ul className="flex max-h-96 flex-col overflow-y-auto">
            {notifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onOpen={handleOpen}
              />
            ))}
          </ul>
        )}

        <DropdownMenuSeparator className="mx-0 my-0" />

        <div className="p-1">
          <Button asChild variant="ghost" size="sm" block className="justify-center">
            <Link href="/admin/notificaciones" onClick={() => setOpen(false)}>
              Ver todas las notificaciones
            </Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
