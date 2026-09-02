'use client';

import { AI_REPLY_TONE_LABELS, AI_REPLY_TONES } from '@conit/types';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@conit/ui';
import { ListChecksIcon, SparklesIcon, TagsIcon, WandSparklesIcon } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/common/page-header';
import { useAiStatus } from '@/hooks/use-ai';

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
        description="Ayuda para redactar, clasificar y resumir incidencias."
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
            Nada se publica ni se aplica de forma automatica: el asistente propone y la persona que
            atiende decide. Un modelo puede equivocarse con seguridad aparente, y un mensaje
            enviado al cliente no se puede retirar.
          </p>

          <Button asChild variant="outline" className="w-fit">
            <Link href="/admin/tickets">Ir a los tickets</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
