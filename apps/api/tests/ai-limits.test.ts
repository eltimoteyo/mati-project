import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AiGateway } from '../src/ai/ai-gateway.service';
import { AnthropicProvider } from '../src/ai/providers/anthropic.provider';
import type { OpenRouterProvider } from '../src/ai/providers/openrouter.provider';
import type { AppConfig } from '../src/config/configuration';
import type { PrismaService } from '../src/database/prisma.service';
import { SettingsService } from '../src/settings/settings.service';

const aiConfig = (overrides: Record<string, unknown> = {}) =>
  ({
    get: () => ({
      provider: 'anthropic',
      apiKey: 'test-key',
      baseUrl: 'https://example.invalid/v1',
      enabled: true,
      model: 'claude-haiku-5-5',
      agentModel: 'claude-sonnet-5-5',
      dailyBudget: 0,
      fallbackModels: [],
      agentFallbackModels: [],
      ...overrides,
    }),
  }) as unknown as ConfigService<AppConfig, true>;

function settingsWith(stored: unknown, config = aiConfig()) {
  const prisma = {
    appSetting: {
      findUnique: vi.fn().mockResolvedValue(stored === undefined ? null : { value: stored }),
      upsert: vi.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaService;

  return { service: new SettingsService(prisma, config), prisma };
}

afterEach(() => vi.unstubAllGlobals());

describe('Limites de la IA', () => {
  it('sin ajustes guardados usa los valores por defecto y el precio conocido del modelo', async () => {
    const { service } = settingsWith(undefined);
    const limits = await service.getAiLimits();

    expect(limits).toMatchObject({
      agentEffort: 'medium',
      quickEffort: 'low',
      agentMaxTokens: 4000,
      turnTimeoutSeconds: 90,
      concurrentConversations: 3,
      inputPriceUsdPerMillion: 2,
      outputPriceUsdPerMillion: 10,
    });
  });

  it('las variables de entorno mandan sobre el precio conocido', async () => {
    const { service } = settingsWith(undefined, aiConfig({ inputPrice: 3, outputPrice: 15 }));

    expect(await service.getAiLimits()).toMatchObject({
      inputPriceUsdPerMillion: 3,
      outputPriceUsdPerMillion: 15,
    });
  });

  it('ignora valores guardados fuera de rango', async () => {
    const { service } = settingsWith({
      agentEffort: 'max',
      turnTimeoutSeconds: 5,
      concurrentConversations: 4,
      inputPriceUsdPerMillion: null,
    });
    const limits = await service.getAiLimits();

    expect(limits.agentEffort).toBe('medium');
    expect(limits.turnTimeoutSeconds).toBe(90);
    expect(limits.concurrentConversations).toBe(4);
    expect(limits.inputPriceUsdPerMillion).toBeNull();
  });

  it('al guardar no borra los campos que no se enviaron', async () => {
    const { service, prisma } = settingsWith({ turnTimeoutSeconds: 120 });

    const next = await service.updateAiLimits({
      concurrentConversations: 2,
      maxToolRounds: undefined,
    });

    expect(next.turnTimeoutSeconds).toBe(120);
    expect(next.concurrentConversations).toBe(2);
    expect(next.maxToolRounds).toBe(5);
    expect(
      (prisma.appSetting.upsert as ReturnType<typeof vi.fn>).mock.calls[0]![0].update.value,
    ).toMatchObject({ turnTimeoutSeconds: 120, concurrentConversations: 2 });
  });

  it('con Claude aplica el razonamiento corto y el minimo de tokens', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ model: 'claude-haiku-5-5', content: [{ type: 'text', text: 'Listo' }] }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { service } = settingsWith({ quickEffort: 'low', minResponseTokens: 3000 });
    const gateway = new AiGateway(
      aiConfig(),
      {} as OpenRouterProvider,
      new AnthropicProvider(aiConfig()),
      service,
    );

    await gateway.complete([{ role: 'user', content: 'Clasifica' }], { maxTokens: 300 });

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string) as Record<string, unknown>;
    expect(body.max_tokens).toBe(3000);
    expect(body.output_config).toEqual({ effort: 'low' });
  });

  it('no envia el esfuerzo a modelos anteriores que lo rechazan', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ model: 'claude-haiku-4-5', content: [{ type: 'text', text: 'Listo' }] }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await new AnthropicProvider(aiConfig()).complete([{ role: 'user', content: 'Hola' }], {
      model: 'claude-haiku-4-5',
      effort: 'low',
    });

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string) as Record<string, unknown>;
    expect(body.output_config).toBeUndefined();
  });
});
