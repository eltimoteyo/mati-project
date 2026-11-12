'use client';

import {
  Button,
  Card,
  cn,
  EmptyState,
  ErrorState,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
  Spinner,
} from '@conit/ui';
import { MessageCircleIcon, PanelRightOpenIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/common/page-header';
import { useInboxConversation, useInboxConversations, useMarkInboxRead } from '@/hooks/use-inbox';

import { InboxChat } from './inbox-chat';
import { InboxConversationList } from './inbox-conversation-list';
import { InboxSidePanel } from './inbox-side-panel';

/** Conversaciones que se cargan de una vez: la bandeja se lee por actividad, no por paginas. */
const LIST_SIZE = 50;

/**
 * Bandeja de WhatsApp.
 *
 * Tres columnas: conversaciones, chat y acciones. En pantallas medianas las
 * acciones pasan a un panel deslizante desde la cabecera del chat, y en movil
 * se ve una sola columna cada vez.
 */
export function InboxView({
  initialConversationId = null,
}: {
  initialConversationId?: string | null;
}) {
  const [search, setSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialConversationId);

  const list = useInboxConversations({
    pageSize: LIST_SIZE,
    search: search || undefined,
    unreadOnly: unreadOnly || undefined,
  });
  const detail = useInboxConversation(selectedId);
  const { mutate: markRead } = useMarkInboxRead();

  const unread = detail.data?.unreadCount ?? 0;

  // Abrir una conversacion la da por leida, y tambien lo que llegue mientras
  // sigue abierta: quien la tiene delante ya lo esta viendo.
  useEffect(() => {
    if (selectedId && unread > 0) markRead(selectedId);
  }, [selectedId, unread, markRead]);

  const conversation = detail.data;

  return (
    <div className="flex flex-col gap-4">
      {/* Sin descripcion: cada linea de cabecera es una linea menos de chat. */}
      <PageHeader title="Bandeja" />

      {/* El panel de identificacion y caso solo cabe fijo en pantallas muy
          anchas; en el resto se abre con "Acciones" y el chat usa todo el ancho. */}
      <Card className="grid h-[calc(100dvh-10rem)] min-h-[30rem] overflow-hidden lg:h-[calc(100dvh-11rem)] lg:grid-cols-[18rem_minmax(0,1fr)] 2xl:grid-cols-[20rem_minmax(0,1fr)_20rem]">
        <section
          aria-label="Conversaciones"
          className={cn('min-h-0 border-border lg:block lg:border-r', selectedId && 'hidden')}
        >
          <InboxConversationList
            conversations={list.data?.items ?? []}
            isPending={list.isPending}
            isError={list.isError}
            onRetry={() => void list.refetch()}
            search={search}
            onSearchChange={setSearch}
            unreadOnly={unreadOnly}
            onUnreadOnlyChange={setUnreadOnly}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </section>

        <section
          aria-label="Chat"
          className={cn('min-h-0 min-w-0', selectedId ? 'block' : 'hidden lg:block')}
        >
          {!selectedId ? (
            <EmptyState
              icon={MessageCircleIcon}
              title="Elige una conversacion"
              description="Los mensajes de cada cliente aparecen a la izquierda, el mas reciente arriba."
              className="h-full"
            />
          ) : detail.isError ? (
            <ErrorState onRetry={() => void detail.refetch()} className="h-full" />
          ) : !conversation ? (
            <div className="flex h-full items-center justify-center">
              <Spinner size="md" label="Cargando conversacion" />
            </div>
          ) : (
            <InboxChat
              conversation={conversation}
              onBack={() => setSelectedId(null)}
              actions={
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="2xl:hidden">
                      <PanelRightOpenIcon />
                      Acciones
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[min(22rem,100vw)] p-0">
                    <SheetTitle className="sr-only">Acciones de la conversacion</SheetTitle>
                    <SheetDescription className="sr-only">
                      Datos del contacto y creacion de tickets.
                    </SheetDescription>
                    <InboxSidePanel conversation={conversation} />
                  </SheetContent>
                </Sheet>
              }
            />
          )}
        </section>

        <aside aria-label="Acciones" className="hidden min-h-0 border-l border-border 2xl:block">
          {conversation ? <InboxSidePanel conversation={conversation} /> : null}
        </aside>
      </Card>
    </div>
  );
}
