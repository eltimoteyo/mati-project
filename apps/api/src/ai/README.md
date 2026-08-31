# Modulo de IA — no implementado (fase posterior)

En la Fase 1 solo existe el **contrato**: [`interfaces/ai-provider.interface.ts`](./interfaces/ai-provider.interface.ts).

No se han creado `ai.module.ts`, `ai.service.ts` ni los archivos de `providers/`
de forma deliberada: un modulo que no se importa en ninguna parte y proveedores
sin implementacion serian codigo muerto que hay que mantener y que induce a
error al leer el repositorio. La abstraccion, en cambio, si aporta valor ahora
porque fija la forma que tendra la integracion.

## Estructura prevista

```text
ai/
├── ai.module.ts                    # Registra proveedores y expone AiService
├── ai.service.ts                   # Selecciona proveedor, reintentos, fallback
├── providers/
│   ├── openrouter.provider.ts
│   ├── groq.provider.ts
│   └── gemini.provider.ts
└── interfaces/
    └── ai-provider.interface.ts    # Ya existe
```

## Cuando se implemente

1. Anadir a `src/config/env.validation.ts` las variables `AI_PROVIDER`,
   `OPENROUTER_API_KEY`, `GROQ_API_KEY` y `GEMINI_API_KEY`, todas **opcionales**,
   para que el sistema siga arrancando sin IA configurada.
2. Implementar cada proveedor contra la interfaz `AiProvider`.
3. Registrarlos en `AiModule` con el token `AI_PROVIDER_TOKEN` (multi-provider).
4. Importar `AiModule` en `AppModule`.
5. `AiService` decide el proveedor activo y aplica fallback si uno falla.

Las claves nunca se versionan: van en `.env` y se documentan en `.env.example`
sin valor real.
