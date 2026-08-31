'use client';

import { type ReactNode, useId } from 'react';

import { cn } from '../lib/utils';
import { Label } from './label';

export interface FieldProps {
  label: string;
  /** Recibe el `id` y los `aria-*` que debe recibir el control. */
  children: (props: {
    id: string;
    'aria-describedby': string | undefined;
    'aria-invalid': true | undefined;
  }) => ReactNode;
  /** Mensaje de error; su presencia marca el campo como invalido. */
  error?: string | undefined;
  /** Texto de ayuda mostrado bajo el control cuando no hay error. */
  hint?: string;
  required?: boolean;
  className?: string;
}

/**
 * Campo de formulario.
 *
 * Encapsula la relacion accesible entre etiqueta, control y mensaje: genera el
 * `id`, enlaza `aria-describedby` con la ayuda o el error, y marca
 * `aria-invalid`. Sin esto, cada formulario tendria que recordar cablear esas
 * tres cosas a mano, que es justo donde se pierde la accesibilidad.
 *
 * @example
 * ```tsx
 * <Field label="Nombre" error={errors.name?.message} required>
 *   {(field) => <Input {...field} {...register('name')} />}
 * </Field>
 * ```
 */
export function Field({ label, children, error, hint, required, className }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>

      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}

      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
