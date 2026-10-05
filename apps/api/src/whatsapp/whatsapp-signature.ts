import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verificacion de la firma de los webhooks de Twilio.
 *
 * Twilio envia `X-Twilio-Signature`: HMAC-SHA1 de la URL completa mas los
 * parametros del formulario, usando el Auth Token como clave. Se implementa a
 * mano en lugar de anadir el SDK de Twilio: son unas cuantas lineas de HMAC y
 * una dependencia menos que auditar en un endpoint publico.
 *
 * Sin esta comprobacion, cualquiera que conociese la URL podria simular
 * mensajes de WhatsApp y crear tickets falsos. Es la unica barrera del
 * endpoint, asi que se falla cerrado: ante cualquier duda, se rechaza.
 *
 * @see https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */

export type TwilioSignatureFailure =
  | 'missing-signature'
  | 'no-match';

export type TwilioSignatureResult =
  | { valid: true }
  | { valid: false; reason: TwilioSignatureFailure };

/**
 * Verifica la firma de un webhook de Twilio.
 *
 * @param url       URL completa del webhook (tal cual Twilio la llamo).
 * @param params    Parametros del formulario codificados, ya decodificados.
 * @param signature Valor del encabezado `X-Twilio-Signature`.
 * @param authToken Auth Token de la cuenta de Twilio.
 */
export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string | undefined,
  authToken: string,
): TwilioSignatureResult {
  if (!signature) {
    return { valid: false, reason: 'missing-signature' };
  }

  const sortedKeys = Object.keys(params).sort();
  let data = url;

  for (const key of sortedKeys) {
    data += key + params[key];
  }

  const expected = createHmac('sha1', authToken).update(data).digest('base64');

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    return { valid: false, reason: 'no-match' };
  }

  return { valid: true };
}
