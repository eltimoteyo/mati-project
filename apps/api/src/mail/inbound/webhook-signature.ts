import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verificacion de la firma de los webhooks de Resend (esquema Svix).
 *
 * Se implementa a mano en lugar de anadir el SDK de Svix: son treinta lineas
 * de HMAC y una dependencia menos que auditar en un endpoint que, por
 * definicion, esta abierto a internet.
 *
 * Sin esta comprobacion cualquiera que conociese la URL podria crear tickets
 * en nombre de un cliente. Es la unica barrera del endpoint, asi que se falla
 * cerrado: ante cualquier duda, se rechaza.
 */

/** Ventana admitida entre la marca de tiempo del envio y la hora local. */
const TOLERANCE_SECONDS = 5 * 60;

export interface SvixHeaders {
  id: string | undefined;
  timestamp: string | undefined;
  signature: string | undefined;
}

export type SignatureFailure =
  | 'missing-headers'
  | 'bad-timestamp'
  | 'expired'
  | 'no-match';

export type SignatureResult = { valid: true } | { valid: false; reason: SignatureFailure };

/**
 * Comprueba la firma de un webhook.
 *
 * @param rawBody Cuerpo **sin parsear**. Serializar de nuevo el objeto no
 *   sirve: bastaria un espacio distinto para que la firma no cuadre.
 */
export function verifySvixSignature(
  rawBody: string,
  headers: SvixHeaders,
  secret: string,
): SignatureResult {
  const { id, timestamp, signature } = headers;

  if (!id || !timestamp || !signature) {
    return { valid: false, reason: 'missing-headers' };
  }

  const sentAt = Number(timestamp);

  if (!Number.isFinite(sentAt)) {
    return { valid: false, reason: 'bad-timestamp' };
  }

  // Acota la reutilizacion de una peticion capturada: pasada la ventana, una
  // copia exacta con su firma valida deja de aceptarse.
  const drift = Math.abs(Math.floor(Date.now() / 1000) - sentAt);

  if (drift > TOLERANCE_SECONDS) {
    return { valid: false, reason: 'expired' };
  }

  // El secreto viaja como `whsec_<base64>`; la clave son los bytes decodificados.
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest();

  // La cabecera admite varias firmas separadas por espacios (rotacion de
  // secreto); basta con que una encaje.
  for (const entry of signature.split(' ')) {
    const [version, value] = entry.split(',');

    if (version !== 'v1' || !value) continue;

    const candidate = Buffer.from(value, 'base64');

    // `timingSafeEqual` exige longitudes iguales y ademas evita filtrar por
    // el tiempo de comparacion cuantos bytes coincidian.
    if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) {
      return { valid: true };
    }
  }

  return { valid: false, reason: 'no-match' };
}
