import { z } from 'zod';

export const stageSchema = z.enum([
  'IDENTIFYING',
  'TRIAGE',
  'TROUBLESHOOTING',
  'ESCALATED',
  'FOLLOW_UP',
  'RESOLVED',
  'ABANDONED',
]);
export const factsSchema = z
  .object({
    service: z.string().max(200).optional(),
    projectId: z.string().uuid().optional(),
    incidentId: z.string().uuid().optional(),
    domain: z.string().max(250).optional(),
    symptom: z.string().max(1500).optional(),
    error: z.string().max(1000).optional(),
    since: z.string().max(150).optional(),
    impact: z.string().max(300).optional(),
    changes: z.string().max(500).optional(),
    contactTime: z.string().max(200).optional(),
  })
  .strict();
export const stepsSchema = z
  .array(
    z
      .object({
        step: z.string().min(1).max(500),
        result: z.enum(['PENDING', 'FAILED', 'WORKED', 'NOT_TRIED']),
      })
      .strict(),
  )
  .max(30);
export const decisionSchema = z
  .object({
    action: z.enum(['reply', 'troubleshoot', 'escalate', 'resolved', 'follow_up']),
    message: z.string().min(1).max(3500),
    summary: z.string().max(2500),
    facts: factsSchema.default({}),
    stepsTried: stepsSchema.default([]),
    solution: z.string().max(2000).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
    categoryId: z.string().uuid().nullable().optional(),
  })
  .strict();
export type SupportDecision = z.infer<typeof decisionSchema>;

const TRANSITIONS: Record<z.infer<typeof stageSchema>, readonly string[]> = {
  IDENTIFYING: ['TRIAGE', 'ESCALATED', 'ABANDONED'],
  TRIAGE: ['TROUBLESHOOTING', 'ESCALATED', 'RESOLVED', 'ABANDONED'],
  TROUBLESHOOTING: ['ESCALATED', 'RESOLVED', 'ABANDONED'],
  ESCALATED: ['FOLLOW_UP', 'RESOLVED', 'ABANDONED'],
  FOLLOW_UP: ['RESOLVED', 'ABANDONED'],
  RESOLVED: [],
  ABANDONED: [],
};
export function canTransition(
  from: z.infer<typeof stageSchema>,
  to: z.infer<typeof stageSchema>,
  identified: boolean,
  confirmed: boolean,
) {
  if (from === to) return true;
  if (!TRANSITIONS[from].includes(to)) return false;
  if ((to === 'TRIAGE' || to === 'TROUBLESHOOTING') && !identified) return false;
  if (to === 'RESOLVED' && !confirmed) return false;
  return true;
}

export function requireVerified(identity: string, clientId: string | null) {
  if (identity !== 'VERIFIED' || !clientId)
    throw new Error('Verifica tu identidad antes de consultar información del cliente.');
  return clientId;
}

/** El catálogo de permisos se aplica incluso si un modelo inventa una herramienta. */
export function permittedTool(name: string, identity: string, clientId: string | null) {
  if (['ver_servicios', 'ver_tickets', 'estado_ticket'].includes(name))
    requireVerified(identity, clientId);
}

/**
 * Pide al cliente que nos mande una contraseña por el chat.
 *
 * Solo cuenta cuando el verbo va dirigido a nosotros ("envíanos", "dime",
 * "¿cuál es tu contraseña?"). Las instrucciones de las guías ("escribe tu
 * nueva contraseña", "indica la contraseña en la app") no se bloquean: son
 * justo lo que el cliente necesita para resolver un problema de acceso.
 */
const ASKS_FOR_SECRET = new RegExp(
  [
    String.raw`\b(?:env[ií][ae]|m[aá]nda|p[aá]sa|comp[aá]rte|d[ií]|ind[ií]ca|escr[ií]be|proporci[oó]na|facil[ií]ta|conf[ií]rma)(?:me|nos)`,
    String.raw`(?:\s+por\s+(?:aqu[ií]|ac[aá]|este\s+(?:medio|chat)|whatsapp|correo))?`,
    String.raw`\s+(?:(?:tu|su|la|el|tus|sus|las|los)\s+)?(?:(?:nueva|actual)\s+)?`,
    String.raw`(?:contrase[nñ]as?|password|clave|token)`,
    String.raw`|\b(?:cu[aá]l\s+es|necesit(?:o|amos)|(?:me|nos)\s+(?:das|da|puedes\s+dar|puede\s+dar))\s+(?:tu|su|la)\s+(?:(?:nueva|actual)\s+)?(?:contrase[nñ]a|password|clave)`,
    String.raw`|\b(?:send|share|tell)\s+(?:me|us)\s+(?:your\s+)?password`,
  ].join(''),
  'i',
);

/**
 * La respuesta contiene una contraseña concreta. Se exige un valor con
 * numeros o simbolos para no confundir "la contraseña es sensible a
 * mayusculas" con una clave real.
 */
const CONTAINS_SECRET =
  /(?:contrase[nñ]a|password|clave)(?:\s+(?:nueva|temporal|actual))?\s*(?:[:=]|\bes\b:?)\s*["'«“]?(?=[^\s"'»”]*[\d@#$%&*!?])[^\s"'»”]{6,}/i;

const LINK = /(?:https?:\/\/|www\.)[^\s<>]+/gi;

function linkAllowed(link: string, allowedDomains: string[]) {
  try {
    const url = new URL(link.startsWith('www.') ? `https://${link}` : link);
    return (
      !url.username &&
      !url.password &&
      ['http:', 'https:'].includes(url.protocol) &&
      allowedDomains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))
    );
  } catch {
    return false;
  }
}

export function safeReply(text: string, allowedDomains: string[]): boolean {
  if (ASKS_FOR_SECRET.test(text) || CONTAINS_SECRET.test(text)) return false;
  if (/sk-[a-zA-Z0-9_-]{15,}|-----BEGIN .*PRIVATE KEY-----/i.test(text)) return false;
  return (text.match(LINK) ?? []).every((link) => linkAllowed(link, allowedDomains));
}

/**
 * Quita las frases con enlaces no permitidos.
 *
 * La IA a veces recomienda una web externa para comprobar una caida. Antes
 * eso descartaba toda la respuesta y se ofrecia un ticket sin contestar al
 * cliente; ahora solo se pierde esa frase.
 */
export function removeUnsafeLinks(text: string, allowedDomains: string[]) {
  return text
    .split('\n')
    .map((line) =>
      line
        .split(/(?<=[.!?])\s+/)
        .filter((sentence) =>
          (sentence.match(LINK) ?? []).every((link) => linkAllowed(link, allowedDomains)),
        )
        .join(' '),
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Firma que el servidor añade a cada mensaje de la IA. */
export const AI_SIGNATURE = '— Asistente virtual de CONIT';

/**
 * Quita la firma, la actual y la anterior (`_Asistente virtual de CONIT_`).
 *
 * La IA ve su firma en los mensajes previos y tiende a copiarla; como el
 * servidor la añade al enviar, salia dos veces.
 */
export function stripSignature(text: string) {
  return text
    .replace(/[—–-]?\s*_?Asistente virtual de CONIT_?/gi, '')
    .replace(/\s+$/, '');
}

export function redactSecrets(text: string) {
  return text
    .replace(/(?:contrase[nñ]a|password|token|api[_ -]?key)\s*[:=]\s*\S+/gi, '[secreto omitido]')
    .replace(/sk-[a-zA-Z0-9_-]{15,}/g, '[secreto omitido]');
}

export function mergeSteps(previous: unknown, next: z.infer<typeof stepsSchema>) {
  const existing = stepsSchema.safeParse(previous);
  const steps = new Map(
    (existing.success ? existing.data : []).map((item) => [item.step.toLocaleLowerCase(), item]),
  );
  for (const item of next) steps.set(item.step.toLocaleLowerCase(), item);
  return [...steps.values()].slice(-30);
}

export function confirmsEscalation(text: string, pending: boolean) {
  if (/^\s*no\b/i.test(text)) return false;
  const affirmative =
    /^\s*(?:s[ií]p?|ok(?:ey|ay)?|vale|dale|claro|bueno|perfecto|correcto|adelante|de acuerdo|est[aá] bien|por favor|confirmo|confirmado|autorizo|hazlo|h[aá]galo|proced[ae]|reg[ií]stra(?:lo|la)?)(?:\s|[.!,]|$)/i.test(
      text,
    );
  const explicit =
    /\b(?:registra|registren|crea|creen)\s+(?:el|mi|un)\s+(?:ticket|caso)\b|\bquiero\s+(?:hablar\s+con\s+)?(?:una persona|un humano|un t[eé]cnico)\b/i.test(
      text,
    );
  return explicit || (pending && affirmative);
}

export function parseDecision(text: string) {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  return decisionSchema.parse(JSON.parse(stripped));
}

/** Los turnos de un caso anterior no pueden pasar a una identidad nueva. */
export function messagesForCase<T extends { createdAt: Date }>(messages: T[], startedAt: Date) {
  return messages.filter((message) => message.createdAt.getTime() >= startedAt.getTime());
}
