import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AnthropicProvider } from '../src/ai/providers/anthropic.provider';
import { OpenRouterProvider } from '../src/ai/providers/openrouter.provider';
import type { AppConfig } from '../src/config/configuration';
import { envSchema } from '../src/config/env.validation';

const config = (provider: string) =>
  ({
    get: (key: string) =>
      key === 'ai'
        ? {
            provider,
            apiKey: 'test-key',
            baseUrl: 'https://example.invalid/v1',
            enabled: true,
            model: 'fast-model',
            agentModel: 'agent-model',
            fallbackModels: ['fallback-model'],
            agentFallbackModels: [],
          }
        : { frontendUrl: 'https://conit.pe' },
  }) as unknown as ConfigService<AppConfig, true>;
afterEach(() => vi.unstubAllGlobals());

describe('Contratos de proveedores de IA', () => {
  it('conserva los bloques firmados al continuar una llamada con herramientas', async () => {
    const native = [
      { type: 'thinking', thinking: 'razonamiento', signature: 'firma-opaca' },
      { type: 'tool_use', id: 'call', name: 'ver_tickets', input: {} },
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ model: 'claude-test', content: [{ type: 'text', text: 'Listo' }] }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    await new AnthropicProvider(config('anthropic')).complete([
      { role: 'user', content: 'Consulta' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'call', name: 'ver_tickets', arguments: '{}' }],
        providerContent: native,
      },
      { role: 'tool', toolCallId: 'call', content: '[]' },
    ]);
    const payload = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(payload.messages[1].content).toEqual(native);
  });
  it('convierte herramientas y resultados al protocolo de Anthropic', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'claude-test',
          content: [{ type: 'tool_use', id: 'call-1', name: 'ver_tickets', input: {} }],
          usage: { input_tokens: 10, output_tokens: 20 },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const result = await new AnthropicProvider(config('anthropic')).complete(
      [
        { role: 'system', content: 'Sistema' },
        { role: 'user', content: 'Hola' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'previous', name: 'ver_servicios', arguments: '{}' }],
        },
        { role: 'tool', toolCallId: 'previous', content: '[]' },
      ],
      { tools: [{ name: 'ver_tickets', description: 'Consulta', parameters: { type: 'object' } }] },
    );
    const [url, request] = fetchMock.mock.calls[0]!;
    const payload = JSON.parse(request.body);
    expect(url).toBe('https://example.invalid/v1/messages');
    expect(request.headers['x-api-key']).toBe('test-key');
    expect(payload.system).toBe('Sistema');
    expect(payload.messages[2].content[0]).toMatchObject({
      type: 'tool_result',
      tool_use_id: 'previous',
    });
    expect(payload.tools[0].input_schema).toEqual({ type: 'object' });
    expect(result.toolCalls?.[0].name).toBe('ver_tickets');
    expect(result.usage?.totalTokens).toBe(30);
  });
  it('acepta una llamada a herramienta de OpenRouter aunque no tenga texto', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'agent-model',
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    id: 'tool-1',
                    function: { name: 'diagnosticar', arguments: '{"dominio":"example.com"}' },
                  },
                ],
              },
            },
          ],
          usage: { prompt_tokens: 30, completion_tokens: 10, cost: 0.01 },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const result = await new OpenRouterProvider(config('openrouter')).complete(
      [{ role: 'user', content: 'Hola' }],
      { tools: [{ name: 'diagnosticar', description: 'DNS', parameters: { type: 'object' } }] },
    );
    const payload = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(payload.model).toBe('agent-model');
    expect(payload.provider).toMatchObject({ data_collection: 'deny', require_parameters: true });
    expect(result.toolCalls).toHaveLength(1);
    expect(result.usage?.cost).toBe(0.01);
  });
  it('no ejecuta una respuesta truncada ni filtra detalles del proveedor', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ content: [], stop_reason: 'max_tokens' }), { status: 200 }),
        ),
    );
    await expect(
      new AnthropicProvider(config('anthropic')).complete([{ role: 'user', content: 'Hola' }]),
    ).rejects.toThrow('incompleta');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('secreto-del-proveedor', { status: 401 })),
    );
    await expect(new AnthropicProvider(config('anthropic')).complete([])).rejects.not.toThrow(
      'secreto-del-proveedor',
    );
  });
  it('admite Claude y configuración sin proveedor de IA', () => {
    const base = {
      DATABASE_URL: 'postgresql://localhost/test',
      JWT_SECRET: 'x'.repeat(40),
      JWT_REFRESH_SECRET: 'y'.repeat(40),
    };
    expect(envSchema.parse(base).AI_PROVIDER).toBe('openrouter');
    expect(
      envSchema.parse({ ...base, AI_INPUT_USD_PER_MILLION: '', AI_OUTPUT_USD_PER_MILLION: '' })
        .AI_INPUT_USD_PER_MILLION,
    ).toBeUndefined();
    expect(envSchema.parse({ ...base, AI_PROVIDER: 'anthropic' }).ANTHROPIC_MODEL).toBeTruthy();
    expect(envSchema.safeParse({ ...base, AI_PROVIDER: 'invented' }).success).toBe(false);
  });
});
