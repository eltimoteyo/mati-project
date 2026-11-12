import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import type { AppConfig } from '../src/config/configuration';
import type { PrismaService } from '../src/database/prisma.service';
import { IdentityService } from '../src/inbox/agent/identity.service';
import { SupportToolsService } from '../src/inbox/agent/support-tools.service';
import { InboxAutoReplyService } from '../src/inbox/inbox-autoreply.service';
import type { MailService } from '../src/mail/mail.service';

function setup(
  options: {
    identity?: string;
    attempts?: number;
    paused?: boolean;
    available?: boolean;
    action?: string;
    inbound?: string;
    message?: string;
    stage?: string;
    ticketId?: string;
    outcome?: { kind: 'confirm' | 'done'; text: string };
  } = {},
) {
  const conversation = {
    id: 'conversation',
    phone: '51999999999',
    clientId: 'client',
    identityStatus: options.identity ?? 'VERIFIED',
    aiPausedUntil: options.paused ? new Date(Date.now() + 100000) : null,
    lastInboundAt: new Date(),
    messages: [
      {
        id: 'inbound',
        body: options.inbound ?? 'El problema continúa',
        direction: 'INBOUND',
        createdAt: new Date(),
      },
    ],
  };
  const supportCase = {
    id: 'case',
    stage: options.stage ?? 'TRIAGE',
    facts: {},
    stepsTried: [],
    attempts: options.attempts ?? 0,
    ticketId: options.ticketId ?? null,
    summary: '',
  };
  const prisma = {
    whatsappConversation: { findUniqueOrThrow: vi.fn().mockResolvedValue(conversation) },
    whatsappMessage: {
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(conversation.messages[0]),
    },
    autoReplyJob: { findUnique: vi.fn().mockResolvedValue({ lockToken: 'lease' }) },
    project: { findMany: vi.fn().mockResolvedValue([]) },
    supportCase: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(supportCase),
      update: vi.fn().mockResolvedValue({}),
    },
    ticket: { findFirst: vi.fn().mockResolvedValue(null) },
  };
  const agent = {
    run: vi
      .fn()
      .mockResolvedValue({
        action: options.action ?? 'troubleshoot',
        message: options.message ?? 'Prueba con otro navegador',
        summary: 'Problema de acceso',
        facts: {},
        stepsTried: [],
        priority: 'MEDIUM',
      }),
  };
  const cases = { current: vi.fn().mockResolvedValue(supportCase) };
  const tools = {
    notify: vi.fn(),
    escalate: vi
      .fn()
      .mockResolvedValue(options.outcome ?? { kind: 'done', text: 'Ticket registrado CNT-0001' }),
  };
  const settings = {
    getAutomation: vi.fn().mockResolvedValue({ whatsappAutoReply: true }),
    getAiLimits: vi.fn().mockResolvedValue({
      maxRepliesPerHour: 10,
      turnTimeoutSeconds: 90,
      replyDelaySeconds: 6,
      concurrentConversations: 3,
    }),
  };
  const cloud = {
    isEnabled: () => true,
    sendText: vi.fn().mockResolvedValue({ sent: true, id: 'external' }),
  };
  const conversations = { recordOutbound: vi.fn() };
  const gateway = { isAvailable: () => options.available !== false };
  const ai = { generateKnowledgeArticle: vi.fn().mockResolvedValue(null) };
  const media = { processPending: vi.fn() };
  const config = { get: () => ({ allowedDomains: ['conit.pe'] }) };
  // El trabajador se usa sin arrancar temporizadores ni hacer llamadas externas.
  const args = [
    prisma,
    agent,
    cases,
    tools,
    settings,
    cloud,
    conversations,
    gateway,
    ai,
    media,
    config,
  ] as unknown as ConstructorParameters<typeof InboxAutoReplyService>;
  const service = new InboxAutoReplyService(...args);
  const respond = () =>
    (service as unknown as { respond: (id: string, token: string) => Promise<void> }).respond(
      'conversation',
      'lease',
    );
  return { respond, prisma, agent, cloud, tools, conversations, supportCase, conversation };
}

describe('Escenarios de la respuesta automática', () => {
  it('pide identificación antes de diagnosticar a un desconocido', async () => {
    const env = setup({ identity: 'UNKNOWN' });
    await env.respond();
    expect(env.cloud.sendText.mock.calls[0]![0].body).toContain('RUC');
    expect(env.tools.escalate).not.toHaveBeenCalled();
  });
  it('deriva después de dos intentos fallidos aunque el modelo proponga un tercero', async () => {
    const env = setup({ attempts: 2 });
    await env.respond();
    expect(env.tools.escalate).toHaveBeenCalledOnce();
    expect(env.prisma.supportCase.update.mock.calls[0]![0].data.attempts).toBeUndefined();
  });
  it('no marca resuelto un problema que el contacto no confirmó', async () => {
    const env = setup({ action: 'resolved' });
    await env.respond();
    expect(env.prisma.supportCase.update.mock.calls[0]![0].data.closedAt).toBeUndefined();
  });
  it('guarda una resolución confirmada por el contacto', async () => {
    const env = setup({ action: 'resolved', inbound: 'Ya funciona correctamente' });
    await env.respond();
    expect(env.prisma.supportCase.update.mock.calls[0]![0].data.stage).toBe('RESOLVED');
  });
  it('se aparta cuando una persona tomó la conversación', async () => {
    const env = setup({ paused: true });
    await env.respond();
    expect(env.agent.run).not.toHaveBeenCalled();
    expect(env.cloud.sendText).not.toHaveBeenCalled();
  });
  it('sin IA avisa al equipo y no crea ticket', async () => {
    const env = setup({ available: false });
    await env.respond();
    expect(env.agent.run).not.toHaveBeenCalled();
    expect(env.tools.escalate).not.toHaveBeenCalled();
    expect(env.conversations.recordOutbound.mock.calls[0]![0].aiAction).toBe('hold');
  });
  it('no envía una respuesta obsoleta si acaba de entrar otro mensaje', async () => {
    const env = setup();
    env.prisma.whatsappConversation.findUniqueOrThrow
      .mockResolvedValueOnce(env.conversation)
      .mockResolvedValue({
        ...env.conversation,
        messages: [{ id: 'new-message', direction: 'INBOUND' }],
      });
    await env.respond();
    expect(env.cloud.sendText).not.toHaveBeenCalled();
  });
  it('con ticket abierto envía lo que contestó la IA, no un estado fijo', async () => {
    const env = setup({
      ticketId: 'ticket',
      stage: 'FOLLOW_UP',
      action: 'reply',
      inbound: '¿Por qué pasa esto?',
      message: 'El dominio no resuelve en DNS: por eso la web no carga.',
    });
    await env.respond();
    const body = env.cloud.sendText.mock.calls[0]![0].body as string;
    expect(body).toContain('El dominio no resuelve en DNS');
    expect(body).not.toContain('está en estado');
    expect(env.tools.escalate).not.toHaveBeenCalled();
  });
  it('si el cliente confirma el registro pendiente, deriva aunque la IA contestara otra cosa', async () => {
    const env = setup({ stage: 'ESCALATED', action: 'reply', inbound: 'dale, regístralo' });
    await env.respond();
    expect(env.tools.escalate).toHaveBeenCalledOnce();
  });
  it('al ofrecer el registro conserva la respuesta de la IA', async () => {
    const env = setup({
      action: 'escalate',
      message: 'Parece un problema del servidor de correo.',
      outcome: { kind: 'confirm', text: '¿Quieres que registre el caso?' },
    });
    await env.respond();
    const body = env.cloud.sendText.mock.calls[0]![0].body as string;
    expect(body).toContain('Parece un problema del servidor de correo.');
    expect(body).toContain('¿Quieres que registre el caso?');
  });
  it('si la IA ya pregunta por el registro no se repite la pregunta', async () => {
    const env = setup({
      action: 'escalate',
      message: 'Parece un problema del servidor. ¿Quieres que lo registre para el equipo?',
      outcome: { kind: 'confirm', text: '¿Quieres que registre el caso?' },
    });
    await env.respond();
    const body = env.cloud.sendText.mock.calls[0]![0].body as string;
    expect(body).not.toContain('¿Quieres que registre el caso?');
  });
  it('un enlace externo no convierte la respuesta en una oferta de ticket', async () => {
    const env = setup({
      action: 'troubleshoot',
      message:
        'Tu web no responde. Compruébalo en https://downforeveryoneorjustme.com por favor. Borra la caché y vuelve a probar.',
    });
    await env.respond();
    const body = env.cloud.sendText.mock.calls[0]![0].body as string;
    expect(env.tools.escalate).not.toHaveBeenCalled();
    expect(body).toContain('Borra la caché');
    expect(body).not.toContain('downforeveryoneorjustme');
  });
  it('la firma sale una sola vez aunque la IA la copie', async () => {
    const env = setup({
      action: 'reply',
      message: '¡Buenas tardes! Cuéntame qué pasa.\n\n— Asistente virtual de CONIT',
    });
    await env.respond();
    const body = env.cloud.sendText.mock.calls[0]![0].body as string;
    expect(body.match(/Asistente virtual de CONIT/g)).toHaveLength(1);
  });
  it('no contesta más de diez veces por hora', async () => {
    const env = setup();
    env.prisma.whatsappMessage.count.mockResolvedValue(10);
    await env.respond();
    expect(env.agent.run).not.toHaveBeenCalled();
    expect(env.cloud.sendText).not.toHaveBeenCalled();
  });
});

describe('Verificación por correo', () => {
  it('envía solo al correo de la ficha y persiste un hash del código', async () => {
    let stored: { codeHash?: string } = {};
    const tx = {
      $queryRaw: vi.fn(),
      whatsappConversation: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue({
            client: { id: 'client', status: 'ACTIVE', email: 'record@example.invalid' },
            identityStatus: 'UNKNOWN',
          }),
      },
      identityChallenge: {
        count: vi.fn().mockResolvedValue(0),
        updateMany: vi.fn(),
        create: vi.fn().mockImplementation(({ data }) => {
          stored = data;
          return { id: 'challenge' };
        }),
      },
    };
    const prisma = {
      $transaction: (fn: (tx: unknown) => unknown) => fn(tx),
    } as unknown as PrismaService;
    const mail = { send: vi.fn().mockResolvedValue({ sent: true }) };
    const config = {
      get: () => ({ accessSecret: 'secret-for-tests' }),
    } as unknown as ConfigService<AppConfig, true>;
    const identity = new IdentityService(prisma, mail as unknown as MailService, config);
    const result = await identity.sendCode('conversation');
    expect(mail.send.mock.calls[0]![0].to).toBe('record@example.invalid');
    const code = mail.send.mock.calls[0]![0].text.match(/\b\d{6}\b/)[0];
    expect(stored.codeHash).toHaveLength(64);
    expect(stored.codeHash).not.toBe(code);
    expect(JSON.stringify(result)).not.toContain(code);
  });
});

describe('Herramientas vinculadas a la conversación', () => {
  function tools(identityStatus: string) {
    const prisma = {
      whatsappConversation: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue({ identityStatus, clientId: 'current-client' }),
      },
      client: { findFirst: vi.fn().mockResolvedValue({ id: 'current-client' }) },
      ticket: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const args = [
      prisma,
      {},
      {},
      {},
      {},
      {},
      { get: () => ({ frontendUrl: 'https://conit.pe' }) },
    ] as unknown as ConstructorParameters<typeof SupportToolsService>;
    return { service: new SupportToolsService(...args), prisma };
  }
  it('ignora cualquier selección de empresa del modelo y filtra por el cliente del servidor', async () => {
    const env = tools('VERIFIED');
    await env.service.execute(
      'ver_tickets',
      {},
      'conversation',
      {} as never,
      '',
      [],
      AbortSignal.timeout(1000),
    );
    expect(env.prisma.ticket.findMany.mock.calls[0]![0].where.clientId).toBe('current-client');
    await expect(
      env.service.execute(
        'ver_tickets',
        { clientId: 'other-client' },
        'conversation',
        {} as never,
        '',
        [],
        AbortSignal.timeout(1000),
      ),
    ).rejects.toThrow();
    expect(env.prisma.ticket.findMany).toHaveBeenCalledOnce();
  });
  it('rechaza la consulta de tickets de una identidad solo declarada', async () => {
    const env = tools('CLAIMED');
    await expect(
      env.service.execute(
        'ver_tickets',
        {},
        'conversation',
        {} as never,
        '',
        [],
        AbortSignal.timeout(1000),
      ),
    ).rejects.toThrow();
    expect(env.prisma.ticket.findMany).not.toHaveBeenCalled();
  });
});
