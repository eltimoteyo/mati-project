import { createHmac, timingSafeEqual } from 'node:crypto';

import type {
  InboundWhatsappMessage,
  WhatsappStatusUpdate,
} from '../whatsapp/whatsapp-conversations.service';

/**
 * Webhook de WhatsApp de Meta: firma y lectura del cuerpo.
 *
 * Se implementa a mano en lugar de anadir un SDK: es un HMAC y un recorrido
 * por un JSON anidado, y una dependencia menos que auditar en un endpoint
 * abierto a internet.
 */

const SIGNATURE_PREFIX = 'sha256=';

export type MetaSignatureResult =
  | { valid: true }
  | { valid: false; reason: 'missing-signature' | 'no-match' };

/**
 * Comprueba la cabecera `X-Hub-Signature-256`.
 *
 * Meta firma los bytes exactos que envia, con caracteres no ASCII escapados.
 * Volver a serializar el objeto ya parseado cambiaria esos bytes, por eso se
 * firma el cuerpo crudo.
 */
export function verifyMetaSignature(
  rawBody: Buffer,
  signature: string | undefined,
  appSecret: string,
): MetaSignatureResult {
  if (!signature?.startsWith(SIGNATURE_PREFIX)) {
    return { valid: false, reason: 'missing-signature' };
  }

  const expected = createHmac('sha256', appSecret).update(rawBody).digest();
  const received = Buffer.from(signature.slice(SIGNATURE_PREFIX.length), 'hex');

  // `timingSafeEqual` exige longitudes iguales y no filtra por el tiempo de
  // comparacion cuantos bytes coincidian.
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return { valid: false, reason: 'no-match' };
  }

  return { valid: true };
}

export interface MetaWebhookEvents {
  messages: InboundWhatsappMessage[];
  statuses: WhatsappStatusUpdate[];
  /**
   * Numeros ajenos cuyos eventos se ignoraron. Se devuelven para dejar
   * constancia: las pruebas del panel de Meta usan un numero ficticio, y sin
   * este rastro pareceria que no llego nada.
   */
  ignoredNumbers: string[];
  /** Campos que traia el aviso (`messages`, `account_update`...), para el registro. */
  fields: string[];
}

/** Estados de entrega de Meta que se reflejan en la bandeja. */
const STATUS_MAP: Record<string, WhatsappStatusUpdate['status']> = {
  sent: 'SENT',
  delivered: 'DELIVERED',
  read: 'READ',
  failed: 'FAILED',
};

/**
 * Extrae mensajes y avisos de entrega del cuerpo del webhook.
 *
 * Todo llega como `unknown` y se comprueba campo a campo: el cuerpo viene de
 * fuera, y un campo que falte o cambie de forma debe descartar ese elemento,
 * no tumbar la peticion entera.
 *
 * @param phoneNumberId Numero propio. Los eventos de otros numeros de la
 *   misma app se ignoran.
 */
export function parseMetaWebhook(
  payload: unknown,
  phoneNumberId: string | undefined,
): MetaWebhookEvents {
  const events: MetaWebhookEvents = { messages: [], statuses: [], ignoredNumbers: [], fields: [] };

  for (const entry of asArray(asRecord(payload)?.['entry'])) {
    for (const change of asArray(asRecord(entry)?.['changes'])) {
      const changeRecord = asRecord(change);

      events.fields.push(asString(changeRecord?.['field']) ?? 'desconocido');

      if (changeRecord?.['field'] !== 'messages') continue;

      const value = asRecord(changeRecord['value']);
      const metadata = asRecord(value?.['metadata']);

      const eventNumber = asString(metadata?.['phone_number_id']);

      if (phoneNumberId && eventNumber !== phoneNumberId) {
        events.ignoredNumbers.push(eventNumber ?? 'sin numero');
        continue;
      }

      const profileNames = new Map<string, string>();

      for (const contact of asArray(value?.['contacts'])) {
        const contactRecord = asRecord(contact);
        const waId = asString(contactRecord?.['wa_id']);
        const name = asString(asRecord(contactRecord?.['profile'])?.['name']);

        if (waId && name) profileNames.set(waId, name);
      }

      for (const message of asArray(value?.['messages'])) {
        const parsed = parseMessage(asRecord(message), profileNames);

        if (parsed) events.messages.push(parsed);
      }

      for (const status of asArray(value?.['statuses'])) {
        const parsed = parseStatus(asRecord(status));

        if (parsed) events.statuses.push(parsed);
      }
    }
  }

  return events;
}

function parseMessage(
  message: Record<string, unknown> | null,
  profileNames: Map<string, string>,
): InboundWhatsappMessage | null {
  const externalId = asString(message?.['id']);
  const phone = asString(message?.['from'])?.replace(/\D/g, '');
  const type = asString(message?.['type']) ?? 'unknown';

  if (!message || !externalId || !phone) return null;

  const seconds = Number(asString(message['timestamp']));

  return {
    externalId,
    phone,
    profileName: profileNames.get(phone) ?? null,
    type: type.slice(0, 30),
    body: describeContent(message, type),
    sentAt: Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : new Date(),
  };
}

function parseStatus(status: Record<string, unknown> | null): WhatsappStatusUpdate | null {
  const externalId = asString(status?.['id']);
  const mapped = STATUS_MAP[asString(status?.['status']) ?? ''];

  if (!status || !externalId || !mapped) return null;

  const error = asRecord(asArray(status['errors'])[0]);
  const detail =
    asString(asRecord(error?.['error_data'])?.['details']) ??
    asString(error?.['message']) ??
    asString(error?.['title']);
  const code = error?.['code'];

  return {
    externalId,
    status: mapped,
    error: detail ? `${detail}${typeof code === 'number' ? ` (codigo ${code})` : ''}` : null,
  };
}

/**
 * Texto legible de un mensaje.
 *
 * Los adjuntos no se descargan: llegan como un identificador que caduca en
 * minutos. Se deja constancia de que existen, con su pie de foto o nombre si
 * lo traen, para que quien atiende sepa que debe pedirlos por otra via.
 */
function describeContent(message: Record<string, unknown>, type: string): string {
  const content = asRecord(message[type]);
  const caption = asString(content?.['caption']);

  switch (type) {
    case 'text':
      return asString(content?.['body']) ?? '';
    case 'image':
      return caption ? `[Imagen] ${caption}` : '[Imagen]';
    case 'video':
      return caption ? `[Video] ${caption}` : '[Video]';
    case 'audio':
      return '[Audio]';
    case 'sticker':
      return '[Sticker]';
    case 'document': {
      const filename = asString(content?.['filename']);
      const label = filename ? `[Documento: ${filename}]` : '[Documento]';

      return caption ? `${label} ${caption}` : label;
    }
    case 'location': {
      const place = [asString(content?.['name']), asString(content?.['address'])]
        .filter(Boolean)
        .join(', ');

      return place ? `[Ubicacion] ${place}` : '[Ubicacion compartida]';
    }
    case 'contacts':
      return '[Contacto compartido]';
    case 'reaction':
      return `[Reacciono con ${asString(content?.['emoji']) ?? 'un emoji'}]`;
    case 'button':
      return asString(content?.['text']) ?? '[Boton]';
    case 'interactive': {
      const reply = asRecord(content?.['button_reply']) ?? asRecord(content?.['list_reply']);

      return asString(reply?.['title']) ?? '[Respuesta interactiva]';
    }
    default:
      return `[Mensaje de tipo "${type}" no compatible]`;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}
