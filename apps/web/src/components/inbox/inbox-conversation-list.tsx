'use client';

import { type InboxConversation, WHATSAPP_MESSAGE_DIRECTIONS } from '@conit/types';
import {
  Avatar,
  AvatarFallback,
  cn,
  EmptyState,
  ErrorState,
  getInitials,
  Input,
  Skeleton,
} from '@conit/ui';
import { InboxIcon, SearchIcon } from 'lucide-react';

import { conversationTitle, formatPhone, shortTime } from './inbox-format';

interface InboxConversationListProps {
  conversations: InboxConversation[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  unreadOnly: boolean;
  onUnreadOnlyChange: (value: boolean) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function ConversationRow({
  conversation,
  selected,
  onSelect,
}: {
  conversation: InboxConversation;
  selected: boolean;
  onSelect: () => void;
}) {
  const title = conversationTitle(conversation);
  const last = conversation.lastMessage;
  const fromUs = last?.direction === WHATSAPP_MESSAGE_DIRECTIONS.OUTBOUND;
  const unread = conversation.unreadCount > 0;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'flex w-full gap-3 border-b border-border px-4 py-3 text-left transition-colors',
          'outline-none focus-visible:bg-accent/60',
          selected ? 'bg-accent/70' : 'hover:bg-accent/40',
        )}
      >
        <Avatar className="mt-0.5 size-9 shrink-0">
          <AvatarFallback className={cn(!conversation.client && 'text-muted-foreground')}>
            {conversation.client ? getInitials(conversation.client.name) : '#'}
          </AvatarFallback>
        </Avatar>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className={cn('truncate text-sm', unread ? 'font-semibold' : 'font-medium')}>
              {title}
            </span>
            <time
              dateTime={conversation.lastMessageAt}
              className={cn(
                'tabular ml-auto shrink-0 text-xs',
                unread ? 'font-medium text-primary' : 'text-muted-foreground',
              )}
            >
              {shortTime(conversation.lastMessageAt)}
            </time>
          </div>

          {conversation.client ? (
            <span className="tabular truncate text-xs text-muted-foreground/80">
              {formatPhone(conversation.phone)}
            </span>
          ) : null}

          <div className="flex items-center gap-2">
            <p
              className={cn(
                'min-w-0 flex-1 truncate text-xs',
                unread ? 'text-foreground/85' : 'text-muted-foreground',
              )}
            >
              {last ? `${fromUs ? 'CONIT: ' : ''}${last.body}` : 'Sin mensajes'}
            </p>

            {unread ? (
              <span
                className="tabular flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[0.6875rem] font-semibold text-primary-foreground"
                aria-label={`${conversation.unreadCount} sin leer`}
              >
                {conversation.unreadCount}
              </span>
            ) : null}
          </div>
        </div>
      </button>
    </li>
  );
}

/** Columna de conversaciones, la mas reciente arriba. */
export function InboxConversationList({
  conversations,
  isPending,
  isError,
  onRetry,
  search,
  onSearchChange,
  unreadOnly,
  onUnreadOnlyChange,
  selectedId,
  onSelect,
}: InboxConversationListProps) {
  const filtered = search !== '' || unreadOnly;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-3 border-b border-border p-4">
        <div className="relative">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar por numero o cliente…"
            aria-label="Buscar conversaciones"
            className="pl-9"
          />
        </div>

        <div
          role="radiogroup"
          aria-label="Filtrar conversaciones"
          className="flex w-fit items-center gap-1 rounded-lg border border-border bg-muted/40 p-1"
        >
          {[
            { value: false, label: 'Todas' },
            { value: true, label: 'No leidas' },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={unreadOnly === option.value}
              onClick={() => onUnreadOnlyChange(option.value)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/22',
                unreadOnly === option.value
                  ? 'bg-card text-foreground shadow-subtle'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isError ? (
          <ErrorState onRetry={onRetry} className="py-10" />
        ) : isPending ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={InboxIcon}
            title={filtered ? 'Sin resultados' : 'Aun no hay mensajes'}
            description={
              filtered
                ? 'Prueba con otra busqueda o muestra todas las conversaciones.'
                : 'Cuando un cliente escriba al WhatsApp de CONIT, su mensaje aparecera aqui.'
            }
            className="px-6 py-12"
          />
        ) : (
          <ul>
            {conversations.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                selected={conversation.id === selectedId}
                onSelect={() => onSelect(conversation.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
