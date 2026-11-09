# IA de soporte

`AiGateway` selecciona `openrouter` o `anthropic` mediante `AI_PROVIDER`.
El contrato admite texto, imágenes, herramientas, resultados y consumo.
Las credenciales permanecen en el servidor.

`AI_MODEL_AGENT` configura WhatsApp; `AI_MODEL_FAST` configura clasificación,
redacción, resúmenes y lectura de imágenes. Si habilitas imágenes, el modelo
rápido también debe soportarlas. Sin claves, la aplicación sigue funcionando.

El agente está en `../inbox/agent/`. Los permisos, intentos, pausa humana,
confirmación y tickets se validan en el servidor; el modelo no elige un cliente.

Configuración y operación: [guía de soporte IA](../../../../docs/support-ai.md).
