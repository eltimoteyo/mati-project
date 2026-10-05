/**
 * Simula un webhook de WhatsApp con firma valida de Twilio.
 * Ejecutar: npx tsx scripts/simulate-whatsapp-webhook.mts
 *
 * Usa el cliente demo "Distribuidora Andina S.A.C." (phone: +51 987 654 321)
 * para probar el flujo completo: recepcion -> creacion de ticket -> IA -> respuesta.
 */

import { createHmac } from 'node:crypto';

const AUTH_TOKEN = '4134b017fb719a84873a74166078a52e';
const WEBHOOK_URL = 'https://purple-breads-spend.loca.lt/api/v1/whatsapp/webhook';

// Tu numero real normalizado: +51 936 929 213 -> 51936929213
const SENDER_PHONE = 'whatsapp:+51936929213';

const params: Record<string, string> = {
  From: SENDER_PHONE,
  Body: 'Hola, no puedo acceder a mi correo corporativo. Me da un error de autenticacion.',
  WaId: '51987654321',
  ProfileName: 'Maria Quispe',
  SmsMessageSid: 'SM' + Math.random().toString(36).slice(2, 18),
  To: 'whatsapp:+14155238886',
  Timestamp: Math.floor(Date.now() / 1000).toString(),
  SmsStatus: 'received',
};

// Twilio firma con los parametros ordenados alfabeticamente.
const sortedKeys = Object.keys(params).sort();
let data = WEBHOOK_URL;
for (const key of sortedKeys) {
  data += key + params[key];
}

const signature = createHmac('sha1', AUTH_TOKEN).update(data).digest('base64');

console.log('=== Simulacion de webhook de WhatsApp ===\n');
console.log(`URL:   ${WEBHOOK_URL}`);
console.log(`From:  ${params.From}`);
console.log(`Body:  ${params.Body}`);
console.log(`WaId:  ${params.WaId}`);
console.log(`Sig:   ${signature.substring(0, 20)}...`);

const formBody = Object.entries(params)
  .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
  .join('&');

const response = await fetch(WEBHOOK_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-Twilio-Signature': signature,
  },
  body: formBody,
});

console.log(`\nRespuesta: HTTP ${response.status}`);
console.log(`Body: ${await response.text()}\n`);

if (response.status === 200) {
  console.log('✓ Webhook procesado correctamente');
} else {
  console.log('✗ Error en el webhook');
  process.exit(1);
}
