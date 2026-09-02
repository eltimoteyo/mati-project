'use client';

import { TICKET_PRIORITIES, TICKET_PRIORITY_LABELS } from '@conit/types';
import {
  Button,
  Card,
  CardContent,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@conit/ui';
import { ArrowLeftIcon, SendIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useCreatePortalTicket, usePortalProfile } from '@/hooks/use-portal';

/** Sin servicio concreto: `Select` no admite el valor vacio. */
const NO_SERVICE = 'none';

/**
 * Que significa cada prioridad para quien reporta.
 *
 * Sin esta guia, todo el mundo marca "Critica". Explicar el criterio hace que
 * la prioridad signifique algo cuando llega al panel.
 */
const PRIORITY_HINTS: Record<string, string> = {
  LOW: 'Puede esperar; no afecta al trabajo diario.',
  MEDIUM: 'Molesta, pero se puede seguir trabajando.',
  HIGH: 'Impide trabajar a varias personas.',
  CRITICAL: 'El servicio esta caido o afecta a toda la organizacion.',
};

/**
 * Alta de incidencia desde el portal.
 *
 * El formulario pide lo minimo: que pasa, en que servicio y con que urgencia.
 * La categoria y el responsable los decide soporte, que es quien tiene el
 * criterio para hacerlo.
 */
export function PortalNewTicket() {
  const router = useRouter();
  const profile = usePortalProfile();
  const createTicket = useCreatePortalTicket();

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState(NO_SERVICE);
  const [priority, setPriority] = useState<string>(TICKET_PRIORITIES.MEDIUM);
  const [touched, setTouched] = useState(false);

  const services = profile.data?.services ?? [];

  const subjectError =
    touched && subject.trim().length < 5
      ? 'Resume la incidencia en al menos 5 caracteres.'
      : undefined;
  const descriptionError =
    touched && description.trim().length < 10
      ? 'Cuentanos algo mas: al menos 10 caracteres.'
      : undefined;

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);

    if (subject.trim().length < 5 || description.trim().length < 10) return;

    createTicket.mutate(
      {
        subject: subject.trim(),
        description: description.trim(),
        projectId: projectId === NO_SERVICE ? null : projectId,
        priority: priority as (typeof TICKET_PRIORITIES)[keyof typeof TICKET_PRIORITIES],
      },
      {
        onSuccess: (ticket) => router.replace(`/portal/incidencias/${ticket.code}`),
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/portal">
          <ArrowLeftIcon />
          Volver
        </Link>
      </Button>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Reportar una incidencia
        </h1>
        <p className="text-sm text-muted-foreground">
          Cuentanos que ocurre. Te confirmaremos por correo en cuanto la recibamos.
        </p>
      </div>

      <Card className="border-border/80 bg-card/90 shadow-subtle">
        <CardContent className="py-6">
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
            <Field
              label="Que ocurre"
              error={subjectError}
              required
              hint="Un resumen corto, como el asunto de un correo."
            >
              {(field) => (
                <Input
                  {...field}
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="El correo corporativo no envia desde ayer"
                  maxLength={200}
                  invalid={Boolean(subjectError)}
                />
              )}
            </Field>

            <Field
              label="Cuentanos mas"
              error={descriptionError}
              required
              hint="Desde cuando ocurre, a quien afecta y que has probado ya. Cuanto mas concreto, antes lo resolvemos."
            >
              {(field) => (
                <Textarea
                  {...field}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={7}
                  maxLength={10_000}
                  placeholder={
                    'Desde ayer por la tarde ningun correo sale del dominio.\nAfecta a todo el equipo administrativo.\nYa hemos probado a reiniciar los equipos.'
                  }
                  invalid={Boolean(descriptionError)}
                />
              )}
            </Field>

            <div className="grid gap-6 sm:grid-cols-2">
              <Field
                label="Servicio afectado"
                hint={
                  services.length === 0
                    ? 'No tienes servicios registrados; puedes dejarlo asi.'
                    : 'Si no lo tienes claro, dejalo sin especificar.'
                }
              >
                {(field) => (
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger id={field.id} aria-describedby={field['aria-describedby']}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_SERVICE}>Sin especificar</SelectItem>
                      {services.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>

              <Field label="Urgencia" hint={PRIORITY_HINTS[priority]}>
                {(field) => (
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger id={field.id} aria-describedby={field['aria-describedby']}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(TICKET_PRIORITIES).map((value) => (
                        <SelectItem key={value} value={value}>
                          {TICKET_PRIORITY_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
            </div>

            <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
              <Button asChild type="button" variant="outline">
                <Link href="/portal">Cancelar</Link>
              </Button>
              <Button type="submit" loading={createTicket.isPending} loadingText="Enviando…">
                <SendIcon />
                Enviar incidencia
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
