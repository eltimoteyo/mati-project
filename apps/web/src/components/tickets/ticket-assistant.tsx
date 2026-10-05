'use client';

import {
  AI_REPLY_TONE_LABELS,
  AI_REPLY_TONES,
  type AiClassification,
  type AiReplyTone,
  type AiSummary,
  type TicketDetail,
} from '@conit/types';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Textarea,
} from '@conit/ui';
import { CheckIcon, ListChecksIcon, SparklesIcon, TagsIcon, WandSparklesIcon } from 'lucide-react';
import { useState } from 'react';

import { TicketPriorityBadge } from '@/components/domain/badges';
import { useAiStatus, useClassifyTicket, useSuggestReply,useSummarizeTicket } from '@/hooks/use-ai';
import { useUpdateTicket } from '@/hooks/use-tickets';
import { notify } from '@/lib/notify';

interface TicketAssistantProps {
  ticket: TicketDetail;
  /** Vuelca la respuesta sugerida en el editor de la conversacion. */
  onDraftReply: (draft: string) => void;
}

/** Propuesta de clasificacion, con su boton de aplicar. */
function ClassificationResult({
  ticket,
  result,
  onApplied,
}: {
  ticket: TicketDetail;
  result: AiClassification;
  onApplied: () => void;
}) {
  const updateTicket = useUpdateTicket();

  const priorityChanges = result.priority !== ticket.priority;
  const categoryChanges = result.categoryId !== null && result.categoryId !== ticket.category?.id;
  const hasChanges = priorityChanges || categoryChanges;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="text-muted-foreground">Prioridad</span>
        <TicketPriorityBadge priority={result.priority} />
        <span className="text-muted-foreground">Categoria</span>
        <span className="font-medium text-foreground">
          {result.categoryName ?? 'Ninguna encaja'}
        </span>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">{result.reasoning}</p>

      {hasChanges ? (
        <Button
          size="sm"
          variant="outline"
          className="w-fit"
          loading={updateTicket.isPending}
          loadingText="Aplicando…"
          onClick={() => {
            updateTicket.mutate(
              {
                idOrCode: ticket.code,
                input: {
                  ...(priorityChanges ? { priority: result.priority } : {}),
                  ...(categoryChanges ? { categoryId: result.categoryId } : {}),
                },
              },
              { onSuccess: onApplied },
            );
          }}
        >
          <CheckIcon />
          Aplicar al ticket
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          El ticket ya esta clasificado asi; no hay nada que cambiar.
        </p>
      )}
    </div>
  );
}

function SummaryResult({ result }: { result: AiSummary }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
      <p className="text-sm leading-relaxed text-foreground/90">{result.summary}</p>

      {result.nextSteps.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium tracking-[0.04em] text-muted-foreground uppercase">
            Proximos pasos
          </span>
          <ul className="ml-4 flex list-disc flex-col gap-1 text-sm text-muted-foreground marker:text-primary">
            {result.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Asistente de soporte del ticket.
 *
 * Propone; no decide. La respuesta sugerida cae en el editor de la
 * conversacion para que el agente la revise y la envie el mismo, y la
 * clasificacion se aplica solo si se pulsa el boton. Si no hay proveedor
 * configurado, el panel no aparece.
 */
export function TicketAssistant({ ticket, onDraftReply }: TicketAssistantProps) {
  const status = useAiStatus();
  const suggestReply = useSuggestReply();
  const classify = useClassifyTicket();
  const summarize = useSummarizeTicket();

  const [tone, setTone] = useState<AiReplyTone>(AI_REPLY_TONES.NEUTRAL);
  const [instructions, setInstructions] = useState('');
  const [classification, setClassification] = useState<AiClassification | null>(null);
  const [summary, setSummary] = useState<AiSummary | null>(null);

  // El panel solo aparece con un proveedor confirmado. Mientras se consulta se
  // reserva el sitio para que la tarjeta no salte al paint, y si la consulta
  // falla se oculta igual: sin saber si hay proveedor, pintar botones que
  // responderian 503 seria peor que no pintar ninguno.
  if (status.isPending) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (!status.data?.enabled) return null;

  const busy = suggestReply.isPending || classify.isPending || summarize.isPending;

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle className="flex items-center gap-2">
          <SparklesIcon className="size-4 text-primary" aria-hidden="true" />
          Asistente
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Todo lo que genera es una propuesta: nada se publica ni se aplica sin que tu lo confirmes.
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {/* --- Redactar una respuesta ---------------------------------------- */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={tone} onValueChange={(value) => setTone(value as AiReplyTone)}>
              <SelectTrigger size="sm" className="w-56" aria-label="Tono de la respuesta">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(AI_REPLY_TONES).map((value) => (
                  <SelectItem key={value} value={value}>
                    {AI_REPLY_TONE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              size="sm"
              disabled={busy}
              loading={suggestReply.isPending}
              loadingText="Redactando…"
              onClick={() => {
                suggestReply.mutate(
                  {
                    idOrCode: ticket.code,
                    input: {
                      tone,
                      ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
                    },
                  },
                  {
                    onSuccess: (result) => {
                      onDraftReply(result.content);
                      notify.success('Borrador listo en el editor', {
                        description: 'Revisalo antes de enviarlo.',
                      });
                    },
                  },
                );
              }}
            >
              <WandSparklesIcon />
              Redactar respuesta
            </Button>
          </div>

          <Textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Indicaciones para esta respuesta (opcional). Por ejemplo: di que ya renovamos el certificado."
            aria-label="Indicaciones para la respuesta"
          />
        </div>

        {/* --- Clasificar y resumir ------------------------------------------ */}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            loading={classify.isPending}
            loadingText="Analizando…"
            onClick={() => {
              classify.mutate(ticket.code, { onSuccess: setClassification });
            }}
          >
            <TagsIcon />
            Sugerir clasificacion
          </Button>

          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            loading={summarize.isPending}
            loadingText="Resumiendo…"
            onClick={() => {
              summarize.mutate(ticket.code, { onSuccess: setSummary });
            }}
          >
            <ListChecksIcon />
            Resumir el caso
          </Button>
        </div>

        {classification ? (
          <ClassificationResult
            ticket={ticket}
            result={classification}
            onApplied={() => setClassification(null)}
          />
        ) : null}

        {summary ? <SummaryResult result={summary} /> : null}

        <p className="text-xs text-muted-foreground">
          Generado por {status.data.model}. Revisa siempre el contenido antes de enviarlo al
          cliente.
        </p>
      </CardContent>
    </Card>
  );
}
