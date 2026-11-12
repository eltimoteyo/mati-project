'use client';

import type { InboxConversationDetail, InboxMessage } from '@conit/types';
import { Badge, Button, cn, Input } from '@conit/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ThumbsDownIcon, ThumbsUpIcon } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';

import { useClientOptions } from '@/hooks/use-clients';
import { notify } from '@/lib/notify';
import { queryKeys } from '@/lib/query-keys';
import { supportService } from '@/services/support.service';

const STAGES: Record<string, string> = {
  IDENTIFYING: 'Identificando',
  TRIAGE: 'Entendiendo el problema',
  TROUBLESHOOTING: 'Probando soluciones',
  ESCALATED: 'Derivando al equipo',
  FOLLOW_UP: 'En seguimiento',
  RESOLVED: 'Resuelto',
  ABANDONED: 'Sin respuesta',
};

export function InboxIdentity({ conversation }: { conversation: InboxConversationDetail }) {
  const clients = useClientOptions();
  const cache = useQueryClient();
  const [selected, setSelected] = useState(conversation.client?.id ?? '');
  const [verified, setVerified] = useState(conversation.identityStatus === 'VERIFIED');
  const link = useMutation({
    mutationFn: () => supportService.link(conversation.id, selected || null, verified),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: queryKeys.inbox.all });
      notify.success('Identificación actualizada');
    },
    onError: (error) => notify.fromError(error, 'No se pudo vincular el cliente'),
  });
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <h3 className="text-sm font-semibold">Identificación</h3>
      <Badge variant={conversation.identityStatus === 'VERIFIED' ? 'success' : 'warning'}>
        {conversation.identityStatus === 'VERIFIED'
          ? 'Verificada'
          : conversation.identityStatus === 'CLAIMED'
            ? 'Pendiente de verificar'
            : 'Sin identificar'}
      </Badge>
      <label className="text-xs">
        Vincular a cliente
        <select
          className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
          value={selected}
          onChange={(event) => {
            setSelected(event.target.value);
            setVerified(false);
          }}
        >
          <option value="">Sin cliente</option>
          {clients.data?.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex gap-2 text-xs">
        <input
          type="checkbox"
          checked={verified}
          disabled={!selected}
          onChange={(event) => setVerified(event.target.checked)}
        />
        Confirmé la identidad de este contacto
      </label>
      <Button
        size="sm"
        variant="outline"
        loading={link.isPending}
        disabled={!selected && !conversation.client}
        onClick={() => link.mutate()}
      >
        Guardar vínculo
      </Button>
    </section>
  );
}

export function InboxCase({ conversation }: { conversation: InboxConversationDetail }) {
  const supportCase = conversation.supportCase;
  if (!supportCase) return null;
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border p-3 text-xs">
      <h3 className="text-sm font-semibold">Caso actual</h3>
      <Badge variant="info">{STAGES[supportCase.stage] ?? supportCase.stage}</Badge>
      <p className="whitespace-pre-wrap">
        {supportCase.summary || 'Aún se están recopilando datos.'}
      </p>
      {Object.entries(supportCase.facts).map(([key, value]) => (
        <p key={key}>
          <span className="font-medium">
            {{
              service: 'Servicio',
              domain: 'Dominio',
              symptom: 'Síntoma',
              error: 'Error',
              since: 'Desde',
              impact: 'Impacto',
              changes: 'Cambios',
              contactTime: 'Horario',
            }[key] ?? key}
            :{' '}
          </span>
          {String(value)}
        </p>
      ))}
      <p>Intentos: {supportCase.attempts} de 2</p>
      <ul className="space-y-1">
        {supportCase.stepsTried.map((step, index) => (
          <li key={index}>
            {step.step} ·{' '}
            {{
              PENDING: 'Pendiente',
              FAILED: 'No funcionó',
              WORKED: 'Funcionó',
              NOT_TRIED: 'No probado',
            }[step.result] ?? step.result}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function InboxMedia({
  conversationId,
  message,
}: {
  conversationId: string;
  message: InboxMessage;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const load = useMutation({
    mutationFn: () => supportService.media(conversationId, message.id),
    onSuccess: (blob) => setUrl(URL.createObjectURL(blob)),
    onError: (error) => notify.fromError(error, 'Adjunto no disponible'),
  });
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  if (!message.mediaAvailable) return null;
  return (
    <div className="py-2">
      {url ? (
        message.mimeType?.startsWith('audio/') ? (
          <audio controls src={url} className="max-w-full" />
        ) : (
          <a href={url} target="_blank" rel="noreferrer">
            <Image
              unoptimized
              width={480}
              height={320}
              src={url}
              alt="Imagen adjunta a la conversación"
              className="h-auto max-h-72 max-w-full rounded-md object-contain"
            />
          </a>
        )
      ) : (
        <Button size="sm" variant="outline" loading={load.isPending} onClick={() => load.mutate()}>
          Abrir {message.mimeType?.startsWith('audio/') ? 'audio' : 'imagen'}
        </Button>
      )}
    </div>
  );
}

/**
 * Valoracion de una respuesta de la IA.
 *
 * Ocupa una linea con dos iconos junto a la hora: debajo de cada mensaje
 * dejaba el chat sin sitio. El motivo solo se pide al marcarla como mala.
 */
export function InboxFeedback({
  conversationId,
  message,
}: {
  conversationId: string;
  message: InboxMessage;
}) {
  const cache = useQueryClient();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const save = useMutation({
    mutationFn: ({ value, note }: { value: number; note: string }) =>
      supportService.feedback(conversationId, message.id, value, note),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: queryKeys.inbox.all });
      setAsking(false);
      setReason('');
      notify.success('Valoración guardada');
    },
    onError: (error) => notify.fromError(error, 'No se pudo guardar la valoración'),
  });

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-0.5">
        <Button
          size="icon-sm"
          variant="ghost"
          className={cn('size-6', message.feedback === 1 && 'text-success')}
          aria-label="Buena respuesta"
          title="Buena respuesta"
          aria-pressed={message.feedback === 1}
          disabled={save.isPending}
          onClick={() => save.mutate({ value: 1, note: '' })}
        >
          <ThumbsUpIcon className="size-3.5" aria-hidden="true" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          className={cn('size-6', message.feedback === -1 && 'text-destructive')}
          aria-label="Mala respuesta"
          title="Mala respuesta"
          aria-pressed={message.feedback === -1}
          disabled={save.isPending}
          onClick={() => setAsking((value) => !value)}
        >
          <ThumbsDownIcon className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
      {asking ? (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate({ value: -1, note: reason });
          }}
        >
          <Input
            aria-label="Motivo de la valoración"
            placeholder="¿Qué falló? (opcional)"
            value={reason}
            maxLength={500}
            autoFocus
            className="h-8 text-xs"
            onChange={(event) => setReason(event.target.value)}
          />
          <Button type="submit" size="sm" variant="outline" loading={save.isPending}>
            Guardar
          </Button>
        </form>
      ) : null}
    </div>
  );
}
