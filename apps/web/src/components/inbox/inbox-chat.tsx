'use client';

import {
  type InboxConversationDetail,
  type InboxMessage,
  OPEN_TICKET_STATUSES,
  WHATSAPP_AI_HANDOFF_HOURS,
  WHATSAPP_MESSAGE_DIRECTIONS,
  WHATSAPP_MESSAGE_STATUS_LABELS,
  WHATSAPP_MESSAGE_STATUSES,
  type WhatsappMessageStatus,
} from '@conit/types';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  cn,
  EmptyState,
  getInitials,
  Textarea,
} from '@conit/ui';
import { type InboxReplyFormValues, inboxReplySchema } from '@conit/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowLeftIcon,
  CheckCheckIcon,
  CheckIcon,
  CircleAlertIcon,
  ClockIcon,
  LockIcon,
  MessageCircleIcon,
  PauseIcon,
  PlayIcon,
  SendIcon,
  SparklesIcon,
} from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';

import { useAiStatus } from '@/hooks/use-ai';
import { useSendInboxReply, useSetInboxAiPaused } from '@/hooks/use-inbox';
import { useAutomationSettings } from '@/hooks/use-settings';

import { conversationTitle, formatPhone } from './inbox-format';

interface InboxChatProps {
  conversation: InboxConversationDetail;
  /** Vuelve a la lista; solo se muestra en pantallas estrechas. */
  onBack: () => void;
  /** Acciones de la cabecera (en pantallas estrechas, el panel lateral). */
  actions?: ReactNode;
}

const STATUS_ICONS: Record<WhatsappMessageStatus, typeof CheckIcon | null> = {
  RECEIVED: null,
  ACCEPTED: ClockIcon,
  SENT: CheckIcon,
  DELIVERED: CheckCheckIcon,
  READ: CheckCheckIcon,
  FAILED: CircleAlertIcon,
};

function MessageStatus({ status }: { status: WhatsappMessageStatus }) {
  const Icon = STATUS_ICONS[status];

  if (!Icon) return null;

  return (
    <span title={WHATSAPP_MESSAGE_STATUS_LABELS[status]} className="flex items-center">
      <Icon
        className={cn(
          'size-3.5',
          status === WHATSAPP_MESSAGE_STATUSES.READ && 'text-info',
          status === WHATSAPP_MESSAGE_STATUSES.FAILED && 'text-destructive',
        )}
        aria-hidden="true"
      />
      <span className="sr-only">{WHATSAPP_MESSAGE_STATUS_LABELS[status]}</span>
    </span>
  );
}

function MessageBubble({ message }: { message: InboxMessage }) {
  const inbound = message.direction === WHATSAPP_MESSAGE_DIRECTIONS.INBOUND;
  const failed = message.status === WHATSAPP_MESSAGE_STATUSES.FAILED;

  return (
    <li className={cn('flex', inbound ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'flex max-w-[85%] flex-col gap-1 rounded-2xl px-3.5 py-2 sm:max-w-[75%]',
          inbound
            ? 'rounded-bl-sm border border-border bg-card'
            : 'rounded-br-sm border border-primary/15 bg-primary/8',
          failed && 'border-destructive/30',
        )}
      >
        {/* Lo enviado lleva firma: en un chat compartido por el equipo hay que
            saber quien contesto, y distinguir a la IA y los avisos automaticos
            de una persona. */}
        {inbound ? null : message.aiGenerated ? (
          <span className="flex items-center gap-1 text-[0.6875rem] font-medium text-info">
            <SparklesIcon className="size-3" aria-hidden="true" />
            Asistente IA
          </span>
        ) : (
          <span className="text-[0.6875rem] font-medium text-primary">
            {message.author?.name ?? 'Aviso automatico'}
          </span>
        )}

        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground/90">
          {message.body}
        </p>

        <div className="flex items-center justify-end gap-1 text-[0.6875rem] text-muted-foreground">
          <time dateTime={message.createdAt} className="tabular">
            {format(new Date(message.createdAt), 'd MMM, HH:mm', { locale: es })}
          </time>
          {inbound ? null : <MessageStatus status={message.status} />}
        </div>

        {failed && message.error ? (
          <p className="text-xs text-destructive">No se entrego: {message.error}</p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Redaccion.
 *
 * Fuera de la ventana de 24 horas se sustituye por un aviso en lugar de
 * dejar escribir: Meta descartaria el mensaje y quien atiende creeria haber
 * contestado.
 */
function Composer({
  conversation,
  aiActive,
}: {
  conversation: InboxConversationDetail;
  /** La IA esta respondiendo en esta conversacion. */
  aiActive: boolean;
}) {
  const send = useSendInboxReply(conversation.id);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InboxReplyFormValues>({
    resolver: zodResolver(inboxReplySchema),
    defaultValues: { body: '' },
  });

  if (!conversation.canReply) {
    return (
      <div className="flex items-start gap-2.5 border-t border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <LockIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>
          {conversation.replyWindowEndsAt
            ? 'Han pasado mas de 24 horas desde su ultimo mensaje. WhatsApp no permite escribirle hasta que vuelva a escribir.'
            : 'El contacto no ha escrito todavia: WhatsApp solo permite responder despues de que escriba.'}
        </p>
      </div>
    );
  }

  const onSubmit = handleSubmit((values) => {
    send.mutate(values, { onSuccess: () => reset({ body: '' }) });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-1.5 border-t border-border p-3">
      <div className="flex items-end gap-2">
        <Textarea
          {...register('body')}
          rows={2}
          placeholder="Escribe una respuesta…"
          aria-label="Respuesta por WhatsApp"
          invalid={Boolean(errors.body)}
          disabled={send.isPending}
          className="max-h-40 min-h-11 resize-none"
          onKeyDown={(event) => {
            // Intro envia y Mayus+Intro salta de linea, como en WhatsApp.
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void onSubmit();
            }
          }}
        />
        <Button type="submit" size="icon" loading={send.isPending} aria-label="Enviar">
          <SendIcon />
        </Button>
      </div>

      {errors.body ? (
        <p role="alert" className="px-1 text-xs text-destructive">
          {errors.body.message}
        </p>
      ) : (
        <p className="px-1 text-xs text-muted-foreground">
          {aiActive
            ? `Si respondes tu, la IA se pausa en este chat durante ${WHATSAPP_AI_HANDOFF_HOURS} h · `
            : ''}
          Intro para enviar · Mayus+Intro para saltar de linea
        </p>
      )}
    </form>
  );
}

/** Hasta cuando se puede responder, en la cabecera del chat. */
function replyWindowLabel(conversation: InboxConversationDetail): string {
  if (!conversation.canReply || !conversation.replyWindowEndsAt) {
    return 'Ventana de respuesta cerrada';
  }

  const end = new Date(conversation.replyWindowEndsAt);

  return `Puedes responder hasta ${format(end, isToday(end) ? "'las' HH:mm" : "d MMM, HH:mm", { locale: es })}`;
}

/**
 * Estado de la respuesta automatica en la conversacion, con su interruptor.
 *
 * Solo aparece si la respuesta automatica esta activada y hay IA configurada:
 * un boton de pausar algo que no esta funcionando solo confundiria.
 */
function AiControl({
  conversation,
  autoReplyOn,
}: {
  conversation: InboxConversationDetail;
  autoReplyOn: boolean;
}) {
  const setPaused = useSetInboxAiPaused(conversation.id);

  if (!autoReplyOn) return null;

  const paused = conversation.aiPaused;
  const until = conversation.aiPausedUntil
    ? format(new Date(conversation.aiPausedUntil), "d MMM, HH:mm", { locale: es })
    : null;

  return (
    <Button
      variant="outline"
      size="sm"
      loading={setPaused.isPending}
      onClick={() => setPaused.mutate(!paused)}
      title={paused && until ? `IA en pausa hasta el ${until}` : 'La IA responde automaticamente'}
      aria-label={paused ? 'Reanudar la IA en esta conversacion' : 'Pausar la IA en esta conversacion'}
    >
      {paused ? <PlayIcon /> : <PauseIcon />}
      <span className="hidden sm:inline">{paused ? 'Reanudar IA' : 'Pausar IA'}</span>
    </Button>
  );
}

/** Chat de una conversacion. */
export function InboxChat({ conversation, onBack, actions }: InboxChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageId = conversation.messages.at(-1)?.id;

  const automation = useAutomationSettings();
  const aiStatus = useAiStatus();
  const autoReplyOn = Boolean(automation.data?.whatsappAutoReply && aiStatus.data?.enabled);
  const aiActive = autoReplyOn && !conversation.aiPaused;
  const followUpTicket = conversation.tickets.find((ticket) =>
    OPEN_TICKET_STATUSES.includes(ticket.status),
  );

  // Al abrir el chat o al llegar un mensaje se baja al final, como en
  // cualquier mensajeria: lo ultimo es lo que se quiere leer.
  useEffect(() => {
    const element = scrollRef.current;

    if (element) element.scrollTop = element.scrollHeight;
  }, [conversation.id, lastMessageId]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={onBack}
          aria-label="Volver a las conversaciones"
        >
          <ArrowLeftIcon />
        </Button>

        <Avatar className="size-9 shrink-0">
          <AvatarFallback className={cn(!conversation.client && 'text-muted-foreground')}>
            {conversation.client ? getInitials(conversation.client.name) : '#'}
          </AvatarFallback>
        </Avatar>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-sm font-semibold">{conversationTitle(conversation)}</h2>
            {conversation.client ? null : <Badge variant="neutral">Numero desconocido</Badge>}
            {autoReplyOn ? (
              !aiActive ? (
                <Badge variant="neutral">IA en pausa</Badge>
              ) : followUpTicket ? (
                // Ya derivada: la IA solo informa del estado hasta que alguien intervenga.
                <Badge variant="info">
                  <SparklesIcon />
                  IA en seguimiento · {followUpTicket.code}
                </Badge>
              ) : (
                <Badge variant="info">
                  <SparklesIcon />
                  IA activa
                </Badge>
              )
            ) : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {conversation.client ? `${formatPhone(conversation.phone)} · ` : ''}
            {replyWindowLabel(conversation)}
          </p>
        </div>

        <AiControl conversation={conversation} autoReplyOn={autoReplyOn} />

        {actions}
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-muted/25 px-4 py-4">
        {conversation.messages.length === 0 ? (
          <EmptyState
            icon={MessageCircleIcon}
            title="Sin mensajes"
            description="Esta conversacion todavia no tiene mensajes."
            className="py-10"
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {conversation.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </ul>
        )}
      </div>

      {/* La clave reinicia el borrador al cambiar de conversacion: un texto a
          medio escribir no debe acabar enviado a otra persona. */}
      <Composer key={conversation.id} conversation={conversation} aiActive={aiActive} />
    </div>
  );
}
