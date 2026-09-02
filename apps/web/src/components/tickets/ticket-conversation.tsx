'use client';

import {
  type Message,
  MESSAGE_VISIBILITIES,
  type MessageVisibility,
  type UserRef,
} from '@conit/types';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  getInitials,
  Textarea,
} from '@conit/ui';
import {
  type CreateMessageFormInput,
  type CreateMessageFormValues,
  createMessageSchema,
} from '@conit/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CheckIcon,
  EllipsisVerticalIcon,
  LockIcon,
  MessagesSquareIcon,
  PencilIcon,
  SendIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { useDeleteMessage, useSendMessage, useUpdateMessage } from '@/hooks/use-messages';

interface TicketConversationProps {
  idOrCode: string;
  messages: Message[];
  /** Usuario actual: determina qué mensajes puede editar. */
  currentUser: UserRef | { id: string } | undefined;
  /**
   * Borrador propuesto por el asistente.
   *
   * Cambia de identidad en cada sugerencia (no solo de texto) para que dos
   * borradores iguales seguidos sigan volcandose en el editor.
   */
  draft?: { id: number; body: string } | null;
}

/** Burbuja de un mensaje. */
function MessageBubble({
  message,
  canManage,
  onEdit,
  onDelete,
}: {
  message: Message;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isInternal = message.visibility === MESSAGE_VISIBILITIES.INTERNAL;

  return (
    <li className="flex gap-3">
      <Avatar className="mt-0.5 size-8 shrink-0">
        <AvatarFallback>{getInitials(message.author?.name ?? '?')}</AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{message.author?.name ?? 'Sistema'}</span>

          {/* Las notas internas se marcan siempre: confundirlas con una
              respuesta al cliente seria un error costoso. */}
          {isInternal ? (
            <Badge variant="warning">
              <LockIcon />
              Nota interna
            </Badge>
          ) : null}

          <time
            dateTime={message.createdAt}
            className="tabular text-xs text-muted-foreground/80"
          >
            {format(new Date(message.createdAt), "d MMM yyyy, HH:mm", { locale: es })}
          </time>

          {message.editedAt ? (
            <span className="text-xs text-muted-foreground/70">(editado)</span>
          ) : null}

          {canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto size-7"
                  aria-label="Acciones del mensaje"
                >
                  <EllipsisVerticalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={onEdit}>
                  <PencilIcon />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                  <Trash2Icon />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <div
          className={cn(
            'rounded-lg border px-3.5 py-2.5',
            isInternal
              ? 'border-warning/25 bg-warning/8'
              : 'border-border bg-muted/40',
          )}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
            {message.body}
          </p>
        </div>
      </div>
    </li>
  );
}

/**
 * Conversacion del ticket.
 *
 * Un solo hilo con dos tipos de mensaje: respuesta al cliente y nota interna.
 * Tenerlos juntos —y distinguidos visualmente— refleja como se trabaja en
 * realidad, en lugar de obligar a saltar entre dos pestanas.
 */
export function TicketConversation({
  idOrCode,
  messages,
  currentUser,
  draft,
}: TicketConversationProps) {
  const [visibility, setVisibility] = useState<MessageVisibility>(MESSAGE_VISIBILITIES.PUBLIC);
  const [editing, setEditing] = useState<Message | null>(null);
  const [editValue, setEditValue] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Message | null>(null);

  const sendMutation = useSendMessage(idOrCode);
  const updateMutation = useUpdateMessage(idOrCode);
  const deleteMutation = useDeleteMessage(idOrCode);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
    // Entrada y salida difieren: `visibility` es opcional al escribir y
    // obligatoria tras aplicar el valor por defecto del esquema.
  } = useForm<CreateMessageFormInput, unknown, CreateMessageFormValues>({
    resolver: zodResolver(createMessageSchema),
    defaultValues: { body: '', visibility: MESSAGE_VISIBILITIES.PUBLIC },
  });

  // Vuelca el borrador en el editor sin pisar lo que el agente este
  // escribiendo: solo se aplica cuando llega uno nuevo.
  const [appliedDraftId, setAppliedDraftId] = useState<number | null>(null);

  if (draft && draft.id !== appliedDraftId) {
    setAppliedDraftId(draft.id);
    setValue('body', draft.body, { shouldValidate: true });
  }

  const onSubmit = handleSubmit((values) => {
    sendMutation.mutate(
      { body: values.body, visibility },
      { onSuccess: () => reset({ body: '', visibility }) },
    );
  });

  const isInternal = visibility === MESSAGE_VISIBILITIES.INTERNAL;

  return (
    <div className="flex flex-col gap-5">
      {messages.length === 0 ? (
        <EmptyState
          icon={MessagesSquareIcon}
          title="Sin mensajes todavia"
          description="Escribe la primera respuesta al cliente o deja una nota para el equipo."
          className="py-10"
        />
      ) : (
        <ul className="flex flex-col gap-5">
          {messages.map((message) =>
            editing?.id === message.id ? (
              <li key={message.id} className="flex flex-col gap-2">
                <Textarea
                  value={editValue}
                  onChange={(event) => setEditValue(event.target.value)}
                  rows={3}
                  aria-label="Editar mensaje"
                  disabled={updateMutation.isPending}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updateMutation.isPending}
                    onClick={() => setEditing(null)}
                  >
                    <XIcon />
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    loading={updateMutation.isPending}
                    onClick={() =>
                      updateMutation.mutate(
                        { messageId: message.id, input: { body: editValue } },
                        { onSuccess: () => setEditing(null) },
                      )
                    }
                  >
                    <CheckIcon />
                    Guardar
                  </Button>
                </div>
              </li>
            ) : (
              <MessageBubble
                key={message.id}
                message={message}
                canManage={Boolean(currentUser && message.author?.id === currentUser.id)}
                onEdit={() => {
                  setEditing(message);
                  setEditValue(message.body);
                }}
                onDelete={() => setPendingDelete(message)}
              />
            ),
          )}
        </ul>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Redaccion                                                            */}
      {/* ------------------------------------------------------------------ */}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3 border-t border-border pt-5">
        <div
          role="radiogroup"
          aria-label="Tipo de mensaje"
          className="flex w-fit items-center gap-1 rounded-lg border border-border bg-muted/40 p-1"
        >
          {Object.values(MESSAGE_VISIBILITIES).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={visibility === value}
              onClick={() => setVisibility(value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/22',
                visibility === value
                  ? 'bg-card text-foreground shadow-subtle'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {value === MESSAGE_VISIBILITIES.PUBLIC ? 'Respuesta al cliente' : 'Nota interna'}
            </button>
          ))}
        </div>

        <Textarea
          {...register('body')}
          rows={4}
          placeholder={
            isInternal
              ? 'Anotacion para el equipo; el cliente no la vera…'
              : 'Escribe la respuesta que recibira el cliente…'
          }
          invalid={Boolean(errors.body)}
          disabled={sendMutation.isPending}
          aria-label={isInternal ? 'Nota interna' : 'Respuesta al cliente'}
        />

        {errors.body ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.body.message}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {isInternal
              ? 'Queda registrada solo para el equipo de soporte.'
              : 'La primera respuesta publica marca el tiempo de atencion.'}
          </p>

          <Button type="submit" size="sm" loading={sendMutation.isPending} loadingText="Enviando…">
            <SendIcon />
            {isInternal ? 'Guardar nota' : 'Enviar respuesta'}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Eliminar mensaje"
        description="El mensaje desaparecera de la conversacion. Esta accion no se puede deshacer."
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (!pendingDelete) return;

          deleteMutation.mutate(pendingDelete.id, { onSettled: () => setPendingDelete(null) });
        }}
      />
    </div>
  );
}
