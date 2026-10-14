'use client';

import {
  type AiTicketDraft,
  type InboxConversationDetail,
  WHATSAPP_MESSAGE_DIRECTIONS,
} from '@conit/types';
import { Badge, Button, Skeleton } from '@conit/ui';
import { type CreateTicketFormInput, VALIDATION_RULES } from '@conit/validation';
import { SparklesIcon, TicketPlusIcon, WandSparklesIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { TicketStatusBadge } from '@/components/domain/badges';
import { TicketFormDialog } from '@/components/tickets/ticket-form-dialog';
import { useAiStatus } from '@/hooks/use-ai';
import { useCreateInboxTicket, useDraftInboxTicket } from '@/hooks/use-inbox';
import { notify } from '@/lib/notify';

import { conversationTitle, formatPhone } from './inbox-format';

const TICKET_RULES = VALIDATION_RULES.ticket;

/** Largo maximo del asunto propuesto a partir del primer mensaje. */
const SUBJECT_PREVIEW_LENGTH = 80;

interface DialogState {
  values: Partial<CreateTicketFormInput>;
  description?: string;
}

/**
 * Mensajes del contacto que aun no tienen ticket.
 *
 * Lo anterior al ultimo ticket creado desde el chat ya esta registrado; si
 * desde entonces no ha escrito nada, se usa toda la conversacion.
 */
function pendingInbound(conversation: InboxConversationDetail) {
  const inbound = conversation.messages.filter(
    (message) => message.direction === WHATSAPP_MESSAGE_DIRECTIONS.INBOUND,
  );
  const since = conversation.tickets[0]?.createdAt;
  const recent = since ? inbound.filter((message) => message.createdAt > since) : inbound;

  return recent.length > 0 ? recent : inbound;
}

/** Valores iniciales del alta manual, tomados del propio chat. */
function prefillFromChat(conversation: InboxConversationDetail): Partial<CreateTicketFormInput> {
  const messages = pendingInbound(conversation);
  const first = messages[0]?.body.replace(/\s+/g, ' ').trim() ?? '';

  const subject =
    first.length > SUBJECT_PREVIEW_LENGTH ? `${first.slice(0, SUBJECT_PREVIEW_LENGTH - 1)}…` : first;

  const description =
    messages.length > 0
      ? `Mensajes recibidos por WhatsApp (${formatPhone(conversation.phone)}):\n\n${messages
          .map((message) => message.body)
          .join('\n')}`
      : '';

  return {
    clientId: conversation.client?.id ?? '',
    subject: subject.length >= TICKET_RULES.subject.minLength ? subject : '',
    description: description.slice(0, TICKET_RULES.description.maxLength),
  };
}

/** Valores del alta a partir de la propuesta de la IA. */
function prefillFromDraft(
  conversation: InboxConversationDetail,
  draft: AiTicketDraft,
): Partial<CreateTicketFormInput> {
  return {
    clientId: conversation.client?.id ?? '',
    subject: draft.subject,
    description: draft.description,
    priority: draft.priority,
    categoryId: draft.categoryId ?? '',
  };
}

/**
 * Panel lateral del chat: quien es el contacto y que hacer con la conversacion.
 *
 * Tres caminos para crear el ticket, de mas a menos control: el formulario
 * rellenado con el chat, el formulario rellenado por la IA para revisarlo, o
 * la IA creandolo directamente. El ultimo exige un cliente conocido, porque
 * es lo unico que la IA no puede deducir del chat.
 */
export function InboxSidePanel({ conversation }: { conversation: InboxConversationDetail }) {
  const aiStatus = useAiStatus();
  const draft = useDraftInboxTicket(conversation.id);
  const create = useCreateInboxTicket(conversation.id);

  // El objeto se guarda al abrir y no se recalcula: el chat se refresca cada
  // pocos segundos y regenerarlo reiniciaria el formulario a medio editar.
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [aiAction, setAiAction] = useState<'review' | 'create' | null>(null);

  const busy = draft.isPending || create.isPending;
  const client = conversation.client;

  const proposeWithAi = () => {
    setAiAction('review');
    draft.mutate(undefined, {
      onSuccess: (result) =>
        setDialog({
          values: prefillFromDraft(conversation, result),
          description: `Propuesta de la IA, revisala antes de crear. ${result.reasoning}`,
        }),
      onSettled: () => setAiAction(null),
    });
  };

  const createWithAi = () => {
    if (!client) return;

    setAiAction('create');
    draft.mutate(undefined, {
      onSuccess: (result) => {
        create.mutate(
          {
            clientId: client.id,
            subject: result.subject,
            description: result.description,
            priority: result.priority,
            categoryId: result.categoryId,
          },
          {
            onError: (error) => notify.fromError(error, 'No se pudo crear el ticket.'),
            onSettled: () => setAiAction(null),
          },
        );
      },
      onError: () => setAiAction(null),
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto p-5">
      {/* --- Contacto ----------------------------------------------------- */}
      <section className="flex flex-col gap-2" aria-labelledby="inbox-contact">
        <h3
          id="inbox-contact"
          className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase"
        >
          Contacto
        </h3>
        <p className="font-medium text-foreground">{conversationTitle(conversation)}</p>
        <div className="flex flex-wrap items-center gap-2">
          {client ? (
            <Badge variant="success">Cliente registrado</Badge>
          ) : (
            <Badge variant="neutral">Numero desconocido</Badge>
          )}
          {client ? (
            <span className="tabular text-xs text-muted-foreground">
              {formatPhone(conversation.phone)}
            </span>
          ) : null}
        </div>
        {conversation.profileName ? (
          <p className="text-xs text-muted-foreground">
            Perfil de WhatsApp: {conversation.profileName}
          </p>
        ) : null}
        {client ? null : (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Al crear un ticket eliges el cliente, y el numero queda asociado a el para los
            siguientes mensajes.
          </p>
        )}
      </section>

      {/* --- Acciones ----------------------------------------------------- */}
      <section className="flex flex-col gap-2" aria-labelledby="inbox-actions">
        <h3
          id="inbox-actions"
          className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase"
        >
          Convertir en ticket
        </h3>

        <Button
          className="w-full"
          disabled={busy}
          onClick={() => setDialog({ values: prefillFromChat(conversation) })}
        >
          <TicketPlusIcon />
          Crear ticket
        </Button>

        {aiStatus.isPending ? (
          <Skeleton className="h-20 w-full" />
        ) : aiStatus.data?.enabled ? (
          <>
            <Button
              variant="outline"
              className="w-full"
              disabled={busy}
              loading={aiAction === 'review'}
              loadingText="Analizando el chat…"
              onClick={proposeWithAi}
            >
              <SparklesIcon />
              Proponer con IA
            </Button>

            <Button
              variant="outline"
              className="w-full"
              disabled={busy || !client}
              loading={aiAction === 'create'}
              loadingText="Creando ticket…"
              onClick={createWithAi}
            >
              <WandSparklesIcon />
              Crear con IA en un clic
            </Button>

            <p className="text-xs leading-relaxed text-muted-foreground">
              {client
                ? '"Proponer" rellena el formulario para que lo revises; "en un clic" lo crea directamente.'
                : 'Para crearlo en un clic el numero debe pertenecer a un cliente.'}
            </p>
          </>
        ) : (
          <p className="text-xs leading-relaxed text-muted-foreground">
            El asistente de IA no esta configurado: el formulario se rellena con los mensajes del
            chat.
          </p>
        )}
      </section>

      {/* --- Tickets ------------------------------------------------------ */}
      <section className="flex flex-col gap-2" aria-labelledby="inbox-tickets">
        <h3
          id="inbox-tickets"
          className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase"
        >
          Tickets de este chat
        </h3>

        {conversation.tickets.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aun no se ha creado ninguno.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {conversation.tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/admin/tickets/${ticket.code}`}
                  className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-accent/40"
                >
                  <span className="flex items-center gap-2">
                    <span className="tabular font-mono text-xs font-medium text-primary">
                      {ticket.code}
                    </span>
                    <TicketStatusBadge status={ticket.status} />
                  </span>
                  <span className="truncate text-sm text-foreground/90">{ticket.subject}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <TicketFormDialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        initialValues={dialog?.values}
        description={dialog?.description}
        createMutation={create}
      />
    </div>
  );
}
