import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { PrismaService } from '../src/database/prisma.service';
import { WhatsappConversationsService } from '../src/whatsapp/whatsapp-conversations.service';

const client = '00000000-0000-4000-8000-000000000001';
const conversation = '00000000-0000-4000-8000-000000000002';
const localClient = '00000000-0000-4000-8000-000000000003';
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  const root = join(process.cwd(), 'prisma', 'migrations');
  const folders = readdirSync(root)
    .filter((folder) => /^\d/.test(folder))
    .sort();
  for (const folder of folders) {
    if (folder === '20261104120000_support_agent') {
      await db.exec(
        `INSERT INTO clients(id,name,email,phone,updated_at) VALUES ('${client}','Prueba','test@example.invalid','+51 999 999 999',NOW()); INSERT INTO whatsapp_conversations(id,phone,client_id,updated_at) VALUES ('${conversation}','51999999999','${client}',NOW()); INSERT INTO clients(id,name,email,phone,updated_at) VALUES ('${localClient}','Local','local@example.invalid','988 777 666',NOW());`,
      );
    }
    await db.exec(readFileSync(join(root, folder, 'migration.sql'), 'utf8'));
  }
});
afterAll(async () => {
  await db?.close();
});

describe('Migraciones completas sobre PostgreSQL embebido', () => {
  it('conserva el teléfono y verifica solo coincidencias exactas', async () => {
    const contact = await db.query(
      'SELECT phone, verified_at FROM client_contacts WHERE client_id=$1',
      [client],
    );
    expect(contact.rows).toHaveLength(1);
    expect(contact.rows[0]).toMatchObject({ phone: '51999999999' });
    const identity = await db.query<{ identity_status: string }>(
      'SELECT identity_status FROM whatsapp_conversations WHERE id=$1',
      [conversation],
    );
    expect(identity.rows[0]?.identity_status).toBe('VERIFIED');
  });
  it('impide dos casos abiertos por conversación y un tercer intento', async () => {
    await db.exec(
      `INSERT INTO support_cases(id, conversation_id, updated_at) VALUES (gen_random_uuid(), '${conversation}', NOW());`,
    );
    await expect(
      db.exec(
        `INSERT INTO support_cases(id, conversation_id, updated_at) VALUES (gen_random_uuid(), '${conversation}', NOW());`,
      ),
    ).rejects.toThrow();
    await expect(
      db.exec(`UPDATE support_cases SET attempts=3 WHERE conversation_id='${conversation}';`),
    ).rejects.toThrow();
    await db.exec(
      `UPDATE support_cases SET closed_at=NOW(), stage='ABANDONED' WHERE conversation_id='${conversation}';`,
    );
    await expect(
      db.exec(
        `INSERT INTO support_cases(id, conversation_id, updated_at) VALUES (gen_random_uuid(), '${conversation}', NOW());`,
      ),
    ).resolves.toBeTruthy();
  });
  it('coalesce trabajos y conserva un trabajo recibido durante el bloqueo', async () => {
    await db.exec(
      `INSERT INTO auto_reply_jobs(conversation_id,run_at) VALUES ('${conversation}',NOW()); UPDATE auto_reply_jobs SET locked_at=NOW(), lock_token=gen_random_uuid();`,
    );
    const before = await db.query<{ version: number; lock_token: string }>(
      'SELECT version,lock_token FROM auto_reply_jobs',
    );
    await db.exec(
      `INSERT INTO auto_reply_jobs(conversation_id,run_at) VALUES ('${conversation}',NOW()) ON CONFLICT(conversation_id) DO UPDATE SET version=auto_reply_jobs.version+1, run_at=EXCLUDED.run_at;`,
    );
    await db.query('DELETE FROM auto_reply_jobs WHERE conversation_id=$1 AND version=$2', [
      conversation,
      before.rows[0]!.version,
    ]);
    const after = await db.query<{ version: number; lock_token: string }>(
      'SELECT version,lock_token FROM auto_reply_jobs',
    );
    expect(after.rows).toHaveLength(1);
    expect(after.rows[0]!.lock_token).toBe(before.rows[0]!.lock_token);
    expect(after.rows[0]!.version).toBe(before.rows[0]!.version + 1);
  });
  it('un contacto revocado no recupera acceso mediante el teléfono heredado', async () => {
    const prisma = {
      $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const sql = strings.reduce(
          (text, piece, i) => text + piece + (i < values.length ? `$${i + 1}` : ''),
          '',
        );
        return (await db.query(sql, values)).rows;
      },
    } as unknown as PrismaService;
    const service = new WhatsappConversationsService(prisma) as unknown as {
      findClientId: (phone: string) => Promise<string | null>;
    };
    expect(await service.findClientId('51999999999')).toBe(client);
    await db.exec(
      `UPDATE client_contacts SET verified_at=NULL, deleted_at=NOW() WHERE client_id='${client}';`,
    );
    expect(await service.findClientId('51999999999')).toBeNull();
    expect(await service.findClientId('999999999')).toBeNull();
    // Una ficha guardada sin +51 se reconoce por el número completo de WhatsApp.
    expect(await service.findClientId('51988777666')).toBe(localClient);
    const local = await db.query('SELECT phone FROM client_contacts WHERE client_id=$1', [
      localClient,
    ]);
    expect(local.rows[0]).toMatchObject({ phone: '51988777666' });
  });
});
