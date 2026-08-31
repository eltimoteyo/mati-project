import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { ApiError } from './api-error';

/**
 * Traslada los errores por campo que devuelve la API al formulario.
 *
 * La API responde `details: { email: ["..."] }` en los fallos de validacion.
 * Sin esto, el usuario solo veria un aviso global y tendria que adivinar que
 * campo corregir.
 *
 * @returns `true` si se asigno al menos un error de campo. Cuando devuelve
 * `false`, quien llama debe mostrar el aviso global.
 */
export function applyApiFieldErrors<TFieldValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TFieldValues>,
  knownFields: ReadonlyArray<Path<TFieldValues>>,
): boolean {
  if (!(error instanceof ApiError) || !error.details) return false;

  let applied = false;

  for (const [field, messages] of Object.entries(error.details)) {
    const message = messages[0];

    if (!message) continue;

    // Solo se asignan campos que el formulario conoce: un `details` con una
    // clave inesperada dejaria el error colgado en un campo inexistente y el
    // formulario no se podria enviar nunca.
    if (!knownFields.includes(field as Path<TFieldValues>)) continue;

    setError(field as Path<TFieldValues>, { type: 'server', message });
    applied = true;
  }

  return applied;
}
