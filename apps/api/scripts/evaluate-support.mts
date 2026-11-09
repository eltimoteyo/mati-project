import 'dotenv/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import { configuration, type AppConfig } from '../src/config/configuration.js';
import { AiGateway } from '../src/ai/ai-gateway.service.js';
import { AnthropicProvider } from '../src/ai/providers/anthropic.provider.js';
import { OpenRouterProvider } from '../src/ai/providers/openrouter.provider.js';
import type { AiMessage } from '../src/ai/interfaces/ai-provider.interface.js';
import { SUPPORT_SYSTEM_PROMPT } from '../src/inbox/agent/support-agent.service.js';
import { SUPPORT_TOOLS } from '../src/inbox/agent/support-tools.service.js';
import { parseDecision, permittedTool, safeReply } from '../src/inbox/agent/support-policy.js';

interface Scenario {
  id: string;
  inbound: string;
  identity: 'UNKNOWN' | 'CLAIMED' | 'VERIFIED';
  attempts: number;
  expectedAction: string;
  summary?: string;
  tools?: Record<string, unknown>;
}
const args = process.argv.slice(2);
if (args[0] === '--help') {
  console.log(
    'pnpm ai:evaluate [fixtures.json] [resultado.json]. Ejecuta llamadas reales al proveedor configurado.',
  );
  process.exit(0);
}
const source = resolve(args[0] ?? 'tests/fixtures/support-evaluations.json');
const destination = resolve(args[1] ?? 'tmp/support-evaluation.json');
const appConfig = configuration();
if (!appConfig.ai.enabled)
  throw new Error('Configura una clave de IA para ejecutar la evaluación real.');
const config = { get: (key: keyof AppConfig) => appConfig[key] } as unknown as ConfigService<
  AppConfig,
  true
>;
const gateway = new AiGateway(
  config,
  new OpenRouterProvider(config),
  new AnthropicProvider(config),
);
const scenarios = JSON.parse(await readFile(source, 'utf8')) as Scenario[];
const results: Array<{
  id: string;
  expected: string;
  actual?: string;
  passed: boolean;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  error?: string;
}> = [];
for (const scenario of scenarios) {
  const started = Date.now();
  let inputTokens = 0;
  let outputTokens = 0;
  let actual: string | undefined;
  let error: string | undefined;
  try {
    const signal = AbortSignal.timeout(30_000);
    const messages: AiMessage[] = [
      { role: 'system', content: `${SUPPORT_SYSTEM_PROMPT}\nCatálogo: []` },
      {
        role: 'user',
        content: JSON.stringify({
          identity: scenario.identity,
          stage: scenario.identity === 'UNKNOWN' ? 'IDENTIFYING' : 'TRIAGE',
          attempts: scenario.attempts,
          summary: scenario.summary ?? '',
          facts: {},
          stepsTried: [],
          untrustedConversation: [{ role: 'cliente', text: scenario.inbound }],
        }),
      },
    ];
    for (let round = 0; round < 5; round++) {
      const response = await gateway.complete(messages, {
        model: appConfig.ai.agentModel,
        tools: SUPPORT_TOOLS,
        maxTokens: 1800,
        signal,
      });
      inputTokens += response.usage?.promptTokens ?? 0;
      outputTokens += response.usage?.completionTokens ?? 0;
      if (!response.toolCalls?.length) {
        const decision = parseDecision(response.content);
        actual = decision.action;
        if (!safeReply(decision.message, appConfig.ai.allowedDomains))
          throw new Error('Respuesta bloqueada por la política de salida');
        break;
      }
      messages.push({
        role: 'assistant',
        content: response.content,
        toolCalls: response.toolCalls,
        providerContent: response.providerContent,
        reasoningDetails: response.reasoningDetails,
      });
      for (const tool of response.toolCalls.slice(0, 8)) {
        let result: unknown;
        try {
          permittedTool(
            tool.name,
            scenario.identity,
            scenario.identity === 'UNKNOWN' ? null : 'fixture-client',
          );
          result = scenario.tools?.[tool.name] ?? {
            message: 'No hay más datos en este escenario. No inventes resultados.',
          };
        } catch {
          result = { error: 'Primero verifica la identidad.' };
        }
        messages.push({ role: 'tool', toolCallId: tool.id, content: JSON.stringify(result) });
      }
    }
  } catch (caught) {
    error = caught instanceof Error ? caught.message : 'Fallo';
  }
  const passed = !error && actual === scenario.expectedAction;
  results.push({
    id: scenario.id,
    expected: scenario.expectedAction,
    actual,
    passed,
    latencyMs: Date.now() - started,
    inputTokens,
    outputTokens,
    error,
  });
  console.log(`${scenario.id}: ${passed ? 'OK' : 'FALLO'} (${actual ?? error ?? 'sin respuesta'})`);
}
await mkdir(dirname(destination), { recursive: true });
await writeFile(
  destination,
  JSON.stringify(
    {
      model: appConfig.ai.agentModel,
      provider: appConfig.ai.provider,
      createdAt: new Date().toISOString(),
      passed: results.filter((result) => result.passed).length,
      total: results.length,
      results,
    },
    null,
    2,
  ),
);
console.log(`Resultado: ${destination}`);
if (results.some((result) => !result.passed)) process.exitCode = 1;
