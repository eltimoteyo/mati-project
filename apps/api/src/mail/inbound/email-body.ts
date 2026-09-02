/**
 * Limpieza del cuerpo de un correo entrante.
 *
 * Al responder, los clientes de correo adjuntan el hilo completo citado. Sin
 * recortarlo, cada respuesta de dos lineas entraria al ticket arrastrando toda
 * la conversacion anterior, y el hilo se volveria ilegible en tres mensajes.
 *
 * El recorte es deliberadamente conservador: ante la duda se conserva el
 * texto. Es preferible un mensaje con algo de cita de mas que uno cortado a
 * mitad de la frase que importaba.
 */

/** Longitud maxima que acepta el modelo de mensajes. */
const MAX_LENGTH = 5000;

/**
 * Marcas que abren la parte citada.
 *
 * Cubren los clientes mas extendidos en espanol e ingles. Todo lo que venga
 * despues de la primera coincidencia se descarta.
 */
const QUOTE_MARKERS: RegExp[] = [
  // Gmail: "El mar, 1 sept 2026 a las 9:00, Nombre <a@b.com> escribio:"
  /^\s*El .+ escribi(?:o|ó):\s*$/im,
  /^\s*On .+ wrote:\s*$/im,
  // Outlook y similares.
  /^\s*-{2,}\s*Mensaje original\s*-{2,}\s*$/im,
  /^\s*-{2,}\s*Original Message\s*-{2,}\s*$/im,
  /^\s*_{5,}\s*$/m,
  /^\s*De:\s.+$/im,
  /^\s*From:\s.+$/im,
  // Firma estandar: todo lo que sigue a "-- " en su propia linea.
  /^--\s*$/m,
];

/** Lineas de cita con ">" al principio. */
const QUOTED_LINE = /^\s*>/;

/**
 * Devuelve el texto util del correo.
 *
 * @returns El cuerpo recortado, o `null` si no queda nada legible.
 */
export function extractReplyText(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let text = raw.replace(/\r\n/g, '\n');

  // Corta en la marca de cita mas temprana.
  let cut = text.length;

  for (const marker of QUOTE_MARKERS) {
    const match = marker.exec(text);

    if (match && match.index < cut) {
      cut = match.index;
    }
  }

  text = text.slice(0, cut);

  // Descarta las lineas citadas sueltas que hayan quedado por delante.
  const lines = text.split('\n').filter((line) => !QUOTED_LINE.test(line));

  // Colapsa los huecos: tres saltos seguidos o mas se quedan en dos.
  const cleaned = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  if (!cleaned) return null;

  return cleaned.length > MAX_LENGTH ? `${cleaned.slice(0, MAX_LENGTH - 1)}…` : cleaned;
}

/**
 * Extrae la direccion de un campo `From`.
 *
 * Acepta tanto `Nombre <a@b.com>` como `a@b.com`, y normaliza a minusculas
 * para poder compararla con la del cliente.
 */
export function extractEmailAddress(from: string | null | undefined): string | null {
  if (!from) return null;

  const angled = /<([^>]+)>/.exec(from);
  const candidate = (angled?.[1] ?? from).trim().toLowerCase();

  // Comprobacion minima: debe parecer una direccion, no un nombre suelto.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate : null;
}

/**
 * Busca el codigo de ticket (`CNT-0042`) en el asunto o en el cuerpo.
 *
 * Se mira primero el asunto: es donde queda al responder, y el cuerpo puede
 * contener codigos de mensajes antiguos citados.
 */
export function findTicketNumber(subject: string | null, body: string | null): number | null {
  for (const source of [subject, body]) {
    if (!source) continue;

    const match = /CNT-(\d{1,9})\b/i.exec(source);

    if (match?.[1]) {
      const parsed = Number.parseInt(match[1], 10);

      if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
    }
  }

  return null;
}

/** Asunto utilizable para un ticket nuevo, sin los prefijos de respuesta. */
export function cleanSubject(subject: string | null | undefined): string | null {
  if (!subject) return null;

  const cleaned = subject
    .replace(/^\s*(?:re|rv|fwd|fw)\s*:\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || null;
}
