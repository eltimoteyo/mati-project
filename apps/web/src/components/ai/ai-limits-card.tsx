'use client';

import { AI_EFFORT_LABELS, AI_EFFORT_LEVELS, type AiLimitsSettings } from '@conit/types';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@conit/ui';
import { type AiLimitsFormInput, type AiLimitsFormValues, aiLimitsSchema } from '@conit/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { SlidersHorizontalIcon } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, type FieldPath, useForm } from 'react-hook-form';

import { useAiLimits, useUpdateAiLimits } from '@/hooks/use-settings';
import { applyApiFieldErrors } from '@/lib/form-errors';
import { notify } from '@/lib/notify';

/** Campos que la API puede senalar como invalidos. */
const KNOWN_FIELDS = [
  'agentEffort',
  'quickEffort',
  'agentMaxTokens',
  'minResponseTokens',
  'turnTimeoutSeconds',
  'maxToolRounds',
  'concurrentConversations',
  'replyDelaySeconds',
  'maxRepliesPerHour',
  'dailyBudgetUsd',
  'inputPriceUsdPerMillion',
  'outputPriceUsdPerMillion',
] as const;

/** Valores del servidor en el formato del formulario: un precio vacio es "sin precio". */
function toForm(limits: AiLimitsSettings): AiLimitsFormInput {
  return {
    ...limits,
    inputPriceUsdPerMillion: limits.inputPriceUsdPerMillion ?? '',
    outputPriceUsdPerMillion: limits.outputPriceUsdPerMillion ?? '',
  };
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="text-xs font-medium tracking-[0.04em] text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

/**
 * Limites de la IA editables sin redesplegar.
 *
 * Se aplican en la siguiente respuesta: el servidor los lee en cada turno.
 * Los valores fuera de rango se rechazan aqui y tambien en la API.
 */
export function AiLimitsCard() {
  const limits = useAiLimits();
  const update = useUpdateAiLimits();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<AiLimitsFormInput, unknown, AiLimitsFormValues>({
    resolver: zodResolver(aiLimitsSchema),
  });

  useEffect(() => {
    if (limits.data) reset(toForm(limits.data));
  }, [limits.data, reset]);

  const onSubmit = handleSubmit((values) => {
    update.mutate(values, {
      onSuccess: (saved) => reset(toForm(saved)),
      onError: (error) => {
        if (!applyApiFieldErrors(error, setError, KNOWN_FIELDS)) {
          notify.fromError(error, 'No se pudieron guardar los limites.');
        }
      },
    });
  });

  const numberField = (
    name: FieldPath<AiLimitsFormInput>,
    label: string,
    hint: string,
    step = '1',
  ) => (
    <Field label={label} error={errors[name]?.message} hint={hint}>
      {(field) => (
        <Input
          {...field}
          {...register(name)}
          type="number"
          step={step}
          inputMode={step === '1' ? 'numeric' : 'decimal'}
          invalid={Boolean(errors[name])}
        />
      )}
    </Field>
  );

  const effortField = (name: 'agentEffort' | 'quickEffort', label: string, hint: string) => (
    <Field label={label} error={errors[name]?.message} hint={hint}>
      {(field) => (
        <Controller
          control={control}
          name={name}
          render={({ field: select }) => (
            <Select value={select.value} onValueChange={select.onChange}>
              <SelectTrigger id={field.id} aria-describedby={field['aria-describedby']}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(AI_EFFORT_LEVELS).map((effort) => (
                  <SelectItem key={effort} value={effort}>
                    {AI_EFFORT_LABELS[effort]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      )}
    </Field>
  );

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle className="flex items-center gap-2">
          <SlidersHorizontalIcon className="size-4 text-primary" aria-hidden="true" />
          Limites y ajustes de la IA
        </CardTitle>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Se aplican en la siguiente respuesta, sin reiniciar el servidor. Los valores que no se
          cambien aqui usan los del servidor.
        </p>
      </CardHeader>

      <CardContent>
        {limits.isPending ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-2/3" />
          </div>
        ) : limits.isError ? (
          <p className="text-sm text-destructive">
            No se pudieron leer los limites. Recarga la pagina.
          </p>
        ) : (
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
            <section className="flex flex-col gap-4">
              <SectionTitle>Razonamiento y tokens (solo Claude)</SectionTitle>
              <div className="grid gap-5 sm:grid-cols-2">
                {effortField(
                  'agentEffort',
                  'Razonamiento del agente de WhatsApp',
                  'Mas razonamiento: mejores diagnosticos, pero mas lento y caro.',
                )}
                {effortField(
                  'quickEffort',
                  'Razonamiento en tareas cortas',
                  'Clasificar, resumir, leer capturas y respuestas del portal.',
                )}
                {numberField(
                  'agentMaxTokens',
                  'Tokens maximos por respuesta del agente',
                  'Incluye el razonamiento. Si es poco, la respuesta se corta.',
                )}
                {numberField(
                  'minResponseTokens',
                  'Tokens minimos por respuesta',
                  'Evita cortes en tareas cortas. Solo se paga lo que se usa.',
                )}
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <SectionTitle>Tiempos y ritmo</SectionTitle>
              <div className="grid gap-5 sm:grid-cols-2">
                {numberField(
                  'turnTimeoutSeconds',
                  'Tiempo maximo por turno (segundos)',
                  'Si se supera, se reintenta y despues se avisa al equipo.',
                )}
                {numberField(
                  'maxToolRounds',
                  'Vueltas de herramientas por turno',
                  'Cuantas veces puede consultar guias, diagnosticos o tickets antes de responder.',
                )}
                {numberField(
                  'concurrentConversations',
                  'Conversaciones atendidas a la vez',
                  'Con 1, un cliente espera a que termine la respuesta de otro.',
                )}
                {numberField(
                  'replyDelaySeconds',
                  'Espera antes de responder (segundos)',
                  'Por si el cliente escribe en varios mensajes seguidos.',
                )}
                {numberField(
                  'maxRepliesPerHour',
                  'Respuestas automaticas por conversacion y hora',
                  'Al llegar al limite se avisa al equipo para que siga una persona.',
                )}
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <SectionTitle>Gasto</SectionTitle>
              <div className="grid gap-5 sm:grid-cols-3">
                {numberField(
                  'dailyBudgetUsd',
                  'Presupuesto diario (USD)',
                  '0 = sin limite. Avisa al 80 % y se detiene al 100 %.',
                  '0.01',
                )}
                {numberField(
                  'inputPriceUsdPerMillion',
                  'Precio de entrada (USD por millon)',
                  'Claude Sonnet 5.5: 2. Vacio = no se calcula el gasto.',
                  '0.01',
                )}
                {numberField(
                  'outputPriceUsdPerMillion',
                  'Precio de salida (USD por millon)',
                  'Claude Sonnet 5.5: 10.',
                  '0.01',
                )}
              </div>
            </section>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={!isDirty || update.isPending}>
                {update.isPending ? 'Guardando...' : 'Guardar cambios'}
              </Button>
              {isDirty ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={update.isPending}
                  onClick={() => reset(toForm(limits.data))}
                >
                  Descartar
                </Button>
              ) : null}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
