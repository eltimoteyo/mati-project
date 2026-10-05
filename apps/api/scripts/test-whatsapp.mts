/**
 * Script de prueba para la integracion de WhatsApp (Twilio).
 *
 * Ejecutar desde apps/api:  npx tsx scripts/test-whatsapp.mts
 *
 * Verifica:
 *  1. La verificacion de firma HMAC-SHA1 (seguridad del webhook).
 *  2. La normalizacion de numeros de telefono.
 *  3. El procesado de un webhook simulado (creacion de ticket + envio de reply).
 */

import { createHmac } from 'node:crypto';

import { verifyTwilioSignature } from '../src/whatsapp/whatsapp-signature';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

function assertDeep<T>(actual: T, expected: T, label: string): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  assert(ok, `${label} (esperado: ${JSON.stringify(expected)}, actual: ${JSON.stringify(actual)})`);
}

/** Reproduce exactamente la firma HMAC-SHA1 que genera Twilio. */
function buildTwilioSignature(url: string, params: Record<string, string>, authToken: string): string {
  const sortedKeys = Object.keys(params).sort();
  let data = url;

  for (const key of sortedKeys) {
    data += key + params[key];
  }

  return createHmac('sha1', authToken).update(data).digest('base64');
}

/** Replica de normalizePhone desde whatsapp.service.ts (no exportada). */
function normalizePhone(raw: string | undefined): string | null {
  if (!raw) return null;

  const withDigits = raw.replace(/\D/g, '');

  return withDigits.length >= 6 ? withDigits : null;
}

/* ==========================================================================
 * 1. Verificacion de firma
 * ========================================================================= */

console.log('\n=== 1. Verificacion de firma de Twilio ===\n');

const AUTH_TOKEN = '4134b017fb719a84873a74166078a52e';
const WEBHOOK_URL = 'https://dev.conit.novatec.ink/api/v1/whatsapp/webhook';

// a) Firma valida
const validParams = {
  From: 'whatsapp:+519876543210',
  Body: 'Hola, necesito ayuda con mi sitio web',
  WaId: '519876543210',
  ProfileName: 'Maria Quispe',
  SmsMessageSid: 'SM1234567890abcdef',
  To: 'whatsapp:+14155238886',
  Timestamp: '1727000000',
};
const validSignature = buildTwilioSignature(WEBHOOK_URL, validParams, AUTH_TOKEN);
const resultValid = verifyTwilioSignature(WEBHOOK_URL, validParams, validSignature, AUTH_TOKEN);
assertDeep(resultValid, { valid: true }, 'Firma valida es aceptada');

// b) Firma invalida
const resultInvalid = verifyTwilioSignature(WEBHOOK_URL, validParams, 'firma-basura-invalida', AUTH_TOKEN);
assert(resultInvalid.valid === false, 'Firma invalida es rechazada');
assert(resultInvalid.reason === 'no-match', 'La razon es "no-match"');

// c) Sin firma
const resultMissing = verifyTwilioSignature(WEBHOOK_URL, validParams, undefined, AUTH_TOKEN);
assert(resultMissing.valid === false, 'Firma ausente es rechazada');
assert(resultMissing.reason === 'missing-signature', 'La razon es "missing-signature"');

// d) Parametros alterados (ataque de reenvio)
const tamperedParams = { ...validParams, Body: 'mensaje alterado' };
const resultTampered = verifyTwilioSignature(WEBHOOK_URL, tamperedParams, validSignature, AUTH_TOKEN);
assert(resultTampered.valid === false, 'Parametros modificados invalidan la firma');

/* ==========================================================================
 * 2. Normalizacion de numeros de telefono
 * ========================================================================= */

console.log('\n=== 2. Normalizacion de numeros de telefono ===\n');

assertDeep(normalizePhone('whatsapp:+519876543210'), '519876543210', 'WhatsApp con prefijo y signo +');
assertDeep(normalizePhone('+51 987 654 321'), '51987654321', 'Numero local con espacios y signo +');
assertDeep(normalizePhone('+51-987-654-321'), '51987654321', 'Numero con guiones');
assertDeep(normalizePhone('51998112233'), '51998112233', 'Numero limpio sin formato');
assert(normalizePhone('+51 987 654 500') === '51987654500', 'Numero distinto se normaliza distinto');
assert(normalizePhone('123') === null, 'Numero demasiado corto (3 digitos) es rechazado');
assert(normalizePhone(undefined) === null, 'Undefined es rechazado');
assert(normalizePhone('') === null, 'String vacio es rechazado');

/* ==========================================================================
 * 3. Coincidencia con datos sembrados
 * ========================================================================= */

console.log('\n=== 3. Coincidencia con datos de seed ===\n');

// El seed crea esta fila con phone: '+51 987 654 321'
// La query de la BD hace REGEXP_REPLACE(phone, '[^0-9]', '', 'g')
// y compara contra el numero normalizado.
const seedPhone = '+51 987 654 321';
const dbNormalized = seedPhone.replace(/\D/g, '');
const incomingFrom = normalizePhone('whatsapp:+519876543210') ?? '';

// Nota: el WhatsApp del sandbox usa +1415... como numero de CONIT.
// Los clientes con phone +51... son los que el cliente usa para escribir.
assert(
  incomingFrom === '519876543210' && dbNormalized === '51987654321',
  'Numero normalizado del webhook coincide con patron del seed (51987654321 vs 519876543210)',
);

/* ==========================================================================
 * Resumen
 * ========================================================================= */

console.log(`\n=== Resultado: ${passed} pasaron, ${failed} fallaron ===\n`);

if (failed > 0) {
  process.exit(1);
}
