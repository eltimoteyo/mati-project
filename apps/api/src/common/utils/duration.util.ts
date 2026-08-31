/**
 * Conversion de duraciones estilo JWT (`15m`, `7d`) a milisegundos.
 *
 * Se necesita porque `@nestjs/jwt` acepta la notacion abreviada, pero las
 * cookies requieren `maxAge` numerico. Mantener una sola implementacion evita
 * que la vigencia del token y la de la cookie se desincronicen.
 */

const UNIT_TO_MS: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

const DURATION_PATTERN = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w)$/i;

/**
 * @param value Duracion abreviada, por ejemplo `15m` o `7d`.
 * @returns Equivalente en milisegundos.
 * @throws Error si el formato no es reconocible.
 */
export function durationToMs(value: string): number {
  const trimmed = value.trim();

  // Un numero suelto se interpreta como segundos, igual que hace `jsonwebtoken`.
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1_000;
  }

  const match = DURATION_PATTERN.exec(trimmed);

  if (!match) {
    throw new Error(
      `Duracion invalida: "${value}". Formatos validos: 500ms, 30s, 15m, 12h, 7d, 2w.`,
    );
  }

  const amount = Number(match[1]);
  const unit = (match[2] ?? 's').toLowerCase();
  const multiplier = UNIT_TO_MS[unit];

  if (multiplier === undefined) {
    throw new Error(`Unidad de duracion no soportada: "${unit}".`);
  }

  return Math.round(amount * multiplier);
}

/** Igual que `durationToMs` pero devuelve segundos enteros. */
export function durationToSeconds(value: string): number {
  return Math.floor(durationToMs(value) / 1_000);
}
