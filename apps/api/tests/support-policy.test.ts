import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  canTransition,
  mergeSteps,
  parseDecision,
  permittedTool,
  redactSecrets,
  safeReply,
} from '../src/inbox/agent/support-policy';
import { parseMetaWebhook, verifyMetaSignature } from '../src/inbox/meta-webhook';
import { extractMentionedHosts, isPublicAddress } from '../src/inbox/service-diagnostics';
import { allowedMediaUrl, matchesMediaType } from '../src/whatsapp/whatsapp-media.service';

describe('Permisos y memoria del caso', () => {
  it('excluye el historial privado de casos anteriores al construir contexto', async () => {
    const { messagesForCase } = await import('../src/inbox/agent/support-policy');
    const old = { createdAt: new Date('2026-11-01'), text: 'Dato privado de otra identidad' };
    const current = { createdAt: new Date('2026-11-04'), text: 'Hola desde un contacto nuevo' };
    expect(messagesForCase([old, current], current.createdAt)).toEqual([current]);
  });
  it('no confunde un condicional con consentimiento para registrar el ticket', async () => {
    const { confirmsEscalation } = await import('../src/inbox/agent/support-policy');
    expect(confirmsEscalation('Si abro la web falla todo', false)).toBe(false);
    expect(confirmsEscalation('Sí, adelante', true)).toBe(true);
    expect(confirmsEscalation('Crea el ticket', false)).toBe(true);
    expect(confirmsEscalation('No quiero que registres el ticket', true)).toBe(false);
  });
  it.each(['ver_tickets', 'estado_ticket', 'ver_servicios'])(
    'bloquea %s antes de verificar',
    (tool) => {
      expect(() => permittedTool(tool, 'UNKNOWN', null)).toThrow();
      expect(() => permittedTool(tool, 'CLAIMED', 'cliente')).toThrow();
      expect(() => permittedTool(tool, 'VERIFIED', 'cliente')).not.toThrow();
    },
  );
  it('valida etapas e impide resolver sin confirmación', () => {
    expect(canTransition('IDENTIFYING', 'TRIAGE', false, false)).toBe(false);
    expect(canTransition('TRIAGE', 'TROUBLESHOOTING', true, false)).toBe(true);
    expect(canTransition('TROUBLESHOOTING', 'RESOLVED', true, false)).toBe(false);
    expect(canTransition('TROUBLESHOOTING', 'RESOLVED', true, true)).toBe(true);
    expect(canTransition('RESOLVED', 'TRIAGE', true, true)).toBe(false);
  });
  it('conserva los pasos fallidos en los turnos siguientes', () => {
    expect(
      mergeSteps(
        [{ step: 'Abrir otra ventana', result: 'FAILED' }],
        [{ step: 'Probar otro navegador', result: 'PENDING' }],
      ),
    ).toHaveLength(2);
    expect(
      mergeSteps([{ step: 'Paso', result: 'PENDING' }], [{ step: 'Paso', result: 'FAILED' }]),
    ).toEqual([{ step: 'Paso', result: 'FAILED' }]);
  });
  it('rechaza datos adicionales del modelo y JSON inválido', () => {
    expect(() => parseDecision('{"clientId":"otra empresa"}')).toThrow();
    expect(() => parseDecision('No es JSON')).toThrow();
  });
  it.each([
    'Envíame tu contraseña',
    'Dime el password',
    'password: 12345678',
    'Por favor, envíanos por aquí tu contraseña del correo',
    '¿Cuál es tu contraseña actual?',
    'Tu contraseña temporal es Conit2026!',
    'Abre https://conit.pe.evil.example/login',
    'Abre https://evil.example',
    'Abre https://usuario:clave@conit.pe',
  ])('bloquea una respuesta peligrosa: %s', (text) =>
    expect(safeReply(text, ['conit.pe'])).toBe(false),
  );
  // Son pasos de las guías de acceso: bloquearlos hacía que la IA derivara
  // a un ticket justo los problemas que mejor puede resolver.
  it.each([
    'Pulsa «¿Olvidó su contraseña?» y escribe tu nueva contraseña dos veces.',
    'En el celular, indica la contraseña de tu correo cuando la app la pida.',
    'Te llegará un correo para cambiar la contraseña; revisa también la carpeta de spam.',
    'La contraseña es sensible a mayúsculas.',
    'Requisitos de la contraseña: mínimo 8 caracteres, con números y letras.',
    'Escríbenos si al cambiar la contraseña aparece algún error.',
  ])('permite instrucciones de acceso: %s', (text) =>
    expect(safeReply(text, ['conit.pe'])).toBe(true),
  );
  it('permite advertencias sobre contraseñas y enlaces oficiales', () => {
    expect(
      safeReply('Nunca envíes contraseñas. Visita https://conit.pe/soporte', ['conit.pe']),
    ).toBe(true);
    expect(redactSecrets('password=privatepassword123 token: abc')).not.toContain(
      'privatepassword123',
    );
  });
});

describe('Red y archivos externos', () => {
  it('rechaza IP literales antes de conectar aunque Node omita DNS', async () => {
    const { safeUrl } = await import('../src/inbox/service-diagnostics');
    expect(safeUrl('http://127.0.0.1/')).toBeNull();
    expect(safeUrl('http://[::ffff:127.0.0.1]/')).toBeNull();
    expect(safeUrl('http://169.254.169.254/')).toBeNull();
    expect(safeUrl('https://1.1.1.1/')).not.toBeNull();
  });
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.20.0.1',
    '192.168.0.1',
    '169.254.169.254',
    '100.64.0.1',
    '::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    'fe80::1',
    'fc00::1',
    '2001:db8::1',
    'not-an-ip',
    '999.999.999.999',
  ])('rechaza destino privado o inválido %s', (ip) => expect(isPublicAddress(ip)).toBe(false));
  it.each(['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111'])('permite IP pública %s', (ip) =>
    expect(isPublicAddress(ip)).toBe(true),
  );
  it('extrae hosts sin confundir un correo o proveedor genérico', () =>
    expect(
      extractMentionedHosts(
        'No abre https://portal.empresa.pe, escribe a persona@empresa.pe o gmail.com',
      ),
    ).toEqual(['portal.empresa.pe']));
  it('solo descarga medios de hosts de Meta permitidos', () => {
    expect(allowedMediaUrl('https://lookaside.fbsbx.com/archivo')).toBe(true);
    expect(allowedMediaUrl('https://lookaside.fbsbx.com.evil.example/archivo')).toBe(false);
    expect(allowedMediaUrl('http://127.0.0.1/archivo')).toBe(false);
    expect(matchesMediaType(Buffer.from('<script>'), 'image/png')).toBe(false);
  });
});

describe('Webhook de Meta', () => {
  it('valida bytes firmados y rechaza manipulación', () => {
    const body = Buffer.from('{"text":"hola"}');
    const secret = 'test-secret';
    const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
    expect(verifyMetaSignature(body, signature, secret).valid).toBe(true);
    expect(verifyMetaSignature(Buffer.from('{}'), signature, secret).valid).toBe(false);
    expect(verifyMetaSignature(body, 'sha256=bad', secret).valid).toBe(false);
  });
  it('extrae el identificador del adjunto sin confiar en campos ausentes', () => {
    const events = parseMetaWebhook(
      {
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  metadata: { phone_number_id: 'our-number' },
                  messages: [
                    {
                      id: 'wamid-test',
                      from: '51999999999',
                      type: 'audio',
                      audio: { id: 'media-test', mime_type: 'audio/ogg' },
                      timestamp: '1800000000',
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
      'our-number',
    );
    expect(events.messages[0]).toMatchObject({ mediaId: 'media-test', mimeType: 'audio/ogg' });
    expect(parseMetaWebhook(null, undefined).messages).toEqual([]);
    expect(parseMetaWebhook({ entry: [{}] }, undefined).messages).toEqual([]);
  });
});
