import { describe, expect, it, vi } from 'vitest';

import { SupportAgentService } from '../src/inbox/agent/support-agent.service';
import { SUPPORT_TOOLS } from '../src/inbox/agent/support-tools.service';

function setup(maxToolRounds: number) {
  const prisma = {
    aiTurn: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { cost: 0 } }),
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    whatsappConversation: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: 'conversation',
        identityStatus: 'VERIFIED',
        clientId: 'client',
        messages: [
          {
            direction: 'INBOUND',
            body: 'Se cayó mi página web',
            aiGenerated: false,
            createdAt: new Date(),
          },
        ],
      }),
    },
    category: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const toolCall = {
    content: '',
    toolCalls: [
      { id: 'call', name: 'buscar_conocimiento', arguments: JSON.stringify({ consulta: 'web' }) },
    ],
    model: 'claude-test',
    provider: 'anthropic',
  };
  const final = {
    content: JSON.stringify({
      action: 'troubleshoot',
      message: 'Borra la caché y prueba en otro navegador.',
      summary: 'Web caída',
    }),
    model: 'claude-test',
    provider: 'anthropic',
  };
  const complete = vi.fn();
  for (let i = 0; i < maxToolRounds; i++) complete.mockResolvedValueOnce(toolCall);
  complete.mockResolvedValueOnce(final);
  const gateway = { complete };
  const tools = { execute: vi.fn().mockResolvedValue({ guias: [] }), notify: vi.fn() };
  const settings = {
    getAiLimits: vi.fn().mockResolvedValue({
      dailyBudgetUsd: 0,
      maxToolRounds,
      agentMaxTokens: 4000,
      agentEffort: 'medium',
      inputPriceUsdPerMillion: null,
      outputPriceUsdPerMillion: null,
    }),
  };
  const config = { get: () => ({ agentModel: 'claude-test', agentEnabled: true }) };
  const args = [prisma, gateway, {}, tools, { verify: vi.fn() }, settings, config] as unknown as
    ConstructorParameters<typeof SupportAgentService>;
  const service = new SupportAgentService(...args);
  const supportCase = {
    id: 'case',
    startedAt: new Date(0),
    stage: 'TRIAGE',
    attempts: 0,
    ticketId: null,
    summary: '',
    facts: {},
    stepsTried: [],
  } as unknown as Parameters<SupportAgentService['run']>[1];

  return { service, supportCase, complete, prisma };
}

describe('Bucle del agente', () => {
  it('agotadas las vueltas pide la respuesta sin herramientas en vez de fallar', async () => {
    const env = setup(2);
    const decision = await env.service.run(
      'conversation',
      env.supportCase,
      AbortSignal.timeout(10_000),
    );

    expect(decision.action).toBe('troubleshoot');
    expect(env.complete).toHaveBeenCalledTimes(3);
    expect(env.complete.mock.calls[0]![1].toolChoice).toBe('auto');
    expect(env.complete.mock.calls[2]![1].toolChoice).toBe('none');
    expect(env.prisma.aiTurn.create.mock.calls[0]![0].data.error).toBeUndefined();
  });

  it('no ofrece herramientas que no hacen nada', () => {
    const names = SUPPORT_TOOLS.map((tool) => tool.name);

    expect(names).not.toContain('crear_ticket');
    expect(names).not.toContain('derivar_a_persona');
    expect(names).not.toContain('guardar_caso');
  });
});
