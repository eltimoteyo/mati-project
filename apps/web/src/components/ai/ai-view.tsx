'use client';

import { AI_REPLY_TONE_LABELS, AI_REPLY_TONES, WHATSAPP_AI_HANDOFF_HOURS } from '@conit/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Switch,
} from '@conit/ui';
import {
  ListChecksIcon,
  MessageCircleIcon,
  SparklesIcon,
  TagsIcon,
  WandSparklesIcon,
} from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/common/page-header';
import { useAiStatus } from '@/hooks/use-ai';
import { useAutomationSettings, useUpdateAutomationSettings } from '@/hooks/use-settings';

const CAPABILITIES = [
  {
    icon: WandSparklesIcon,
    title: 'Redactar una respuesta',
    description:
      'Propone el mensaje para el cliente a partir del ticket y de la conversacion, con el tono ' +
      'que elijas. El borrador cae en el editor: lo revisas y lo envias tu.',
  },
  {
    icon: TagsIcon,
    title: 'Sugerir clasificacion',
    description:
      'Propone categoria y prioridad, y explica por que. La categoria sale del catalogo real; ' +
      'nunca se inventa una. Se aplica solo si pulsas el boton.',
  },
  {
    icon: ListChecksIcon,
    title: 'Resumir el caso',
    description:
      'Condensa un hilo largo en unas frases y lista los proximos pasos, para que otro agente ' +
      'pueda retomarlo sin leerlo entero.',
  },
];

/**
 * Interruptor de la respuesta automatica por WhatsApp.
 *
 * Explica que hace antes de que alguien lo active: que una IA conteste a los
 * clientes es una decision que se toma sabiendo cuando deja de hacerlo.
 */
function AutoReplyCard({ aiEnabled }: { aiEnabled: boolean }) {
  const settings = useAutomationSettings();
  const update = useUpdateAutomationSettings();
  const checked = settings.data?.whatsappAutoReply ?? false;

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <MessageCircleIcon className="size-4 text-primary" aria-hidden="true" />
            Respuesta automatica en WhatsApp
          </CardTitle>

          {settings.isPending ? (
            <Skeleton className="h-6 w-11 rounded-full" />
          ) : (
            <Switch
              checked={checked}
              disabled={update.isPending || settings.isError}
              onCheckedChange={(value) => update.mutate({ whatsappAutoReply: value })}
              aria-label="Respuesta automatica en WhatsApp"
            />
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
        <p className="max-w-3xl">
          La IA atiende los mensajes que llegan a la Bandeja como un primer nivel de soporte:
          contesta saludos y dudas, y ante un problema explica que podria estar pasando y propone
          pasos para probar. Para eso usa la base de conocimiento, los servicios del cliente y
          comprobaciones automaticas de sus webs y dominios. Firma como asistente virtual para que
          el cliente sepa que no es una persona.
        </p>
        <p className="max-w-3xl">
          Si tras dos intentos el problema sigue, o hace falta el equipo tecnico, crea el ticket con
          el diagnostico, le explica al cliente lo que cree que pasa y le da el codigo. Despues sigue
          informando del estado del ticket para que el cliente no quede sin respuesta, hasta que
          alguien del equipo responda en el chat: entonces se aparta {WHATSAPP_AI_HANDOFF_HOURS}{' '}
          horas.
        </p>
        {settings.isError ? (
          <p className="text-destructive">No se pudo leer el ajuste. Recarga la pagina.</p>
        ) : !aiEnabled ? (
          <p className="text-warning">
            Sin proveedor de IA configurado no responde nada, aunque este activada.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Asistente de soporte.
 *
 * Esta pagina explica que hace y donde se usa; el asistente en si vive dentro
 * de cada ticket, que es donde tiene el contexto para ser util.
 */
export function AiView() {
  const status = useAiStatus();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Asistente de soporte"
        description="Respuesta automatica por WhatsApp y ayuda para redactar, clasificar y resumir incidencias."
      />

      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <SparklesIcon className="size-4 text-primary" aria-hidden="true" />
              Estado
            </CardTitle>

            {status.isPending ? (
              <Skeleton className="h-6 w-24" />
            ) : status.isError ? (
              <Badge variant="warning">Sin verificar</Badge>
            ) : status.data?.enabled ? (
              <Badge variant="success">Disponible</Badge>
            ) : (
              <Badge variant="neutral">No configurado</Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          {status.isPending ? (
            <Skeleton className="h-5 w-72" />
          ) : status.isError ? (
            // Un fallo al consultar el estado no significa que falte la clave:
            // sin esta distincion se le pide al usuario que configure algo
            // que puede que ya este bien, y el problema real queda oculto.
            <p className="text-sm text-muted-foreground">
              No se pudo consultar el estado del asistente. Recarga la pagina para intentarlo de
              nuevo; si el problema persiste, revisa que la API este accesible.
            </p>
          ) : status.data?.enabled ? (
            <p className="text-sm text-muted-foreground">
              Modelo activo:{' '}
              <span className="font-mono text-xs text-foreground">{status.data.model}</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No hay proveedor configurado. Define <code className="font-mono">OPENROUTER_API_KEY</code>{' '}
              en el entorno de la API para activarlo. Mientras tanto, las acciones de asistente no
              aparecen en los tickets.
            </p>
          )}
        </CardContent>
      </Card>

      <AutoReplyCard aiEnabled={status.data?.enabled === true} />

      <div className="grid gap-4 md:grid-cols-3">
        {CAPABILITIES.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardContent className="flex flex-col gap-3 py-6">
              <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle>Como se usa</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            El asistente aparece dentro de cada ticket, bajo la conversacion. Ahi tiene el contexto
            —cliente, servicio, historial y mensajes, incluidas las notas internas— que necesita
            para proponer algo util.
          </p>

          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-4">
            <span className="text-xs font-medium tracking-[0.04em] text-muted-foreground uppercase">
              Tonos disponibles al redactar
            </span>
            <ul className="flex flex-wrap gap-2">
              {Object.values(AI_REPLY_TONES).map((tone) => (
                <li
                  key={tone}
                  className="rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {AI_REPLY_TONE_LABELS[tone]}
                </li>
              ))}
            </ul>
          </div>

          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Dentro de cada ticket, el asistente propone y la persona que atiende decide. Ademas, la
            IA actua sola en tres sitios, y lo que escribe queda marcado como respuesta automatica
            para que nadie lo confunda con una persona: la respuesta por WhatsApp (si esta activada
            arriba), la primera respuesta a lo que el cliente escribe en el portal y el mensaje de
            cierre al resolver un ticket.
          </p>

          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Al resolver un ticket tambien propone un articulo para la base de conocimiento, que
            queda como borrador hasta que alguien lo revise y lo publique.
          </p>

          <Button asChild variant="outline" className="w-fit">
            <Link href="/admin/tickets">Ir a los tickets</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
