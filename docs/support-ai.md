# IA de soporte por WhatsApp

La API admite Anthropic directo y OpenRouter. Incluye agente, memoria del caso,
identificación, herramientas, cola persistente, diagnósticos, adjuntos, métricas
y pruebas. Los servicios externos se activan al configurar sus credenciales.

## Conectar Claude

En `apps/api/.env` en local o en las variables de la API en Railway:

```dotenv
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=REEMPLAZAR_EN_EL_ENTORNO
AI_MODEL_AGENT=claude-sonnet-5-5
AI_MODEL_FAST=claude-haiku-5-5
AI_AGENT_ENABLED=true
```

Los identificadores son configurables: comprueba disponibilidad en tu cuenta.
Usa claves diferentes para desarrollo y producción. Anthropic directo no requiere
OpenRouter para texto, herramientas o imágenes. Audio requiere otro proveedor.

Para OpenRouter conserva `AI_PROVIDER=openrouter`, define `OPENROUTER_API_KEY`
y elige IDs de su catálogo en `AI_MODEL_AGENT` y `AI_MODEL_FAST`.
`OPENROUTER_MODEL_AGENT` y `OPENROUTER_MODEL_FAST` son alias. Los valores
existentes `OPENROUTER_MODEL` y `OPENROUTER_FALLBACK_MODELS` siguen funcionando
para tareas simples. `AI_AGENT_FALLBACK_MODELS` configura respaldos del agente
en OpenRouter; todos deben admitir herramientas. El enrutamiento exige soporte
de parámetros y deniega proveedores que recopilan datos.

Si un modelo rechaza herramientas, se intenta JSON con contexto calculado por
el servidor. `AI_AGENT_ENABLED=false` utiliza el flujo anterior para verificados.

Referencias: [Messages API](https://platform.claude.com/docs/en/api/messages/create),
[modelos de Claude](https://platform.claude.com/docs/en/models/overview) y
[herramientas en OpenRouter](https://openrouter.ai/docs/guides/features/tool-calling).

## Preparación y despliegue

```bash
pnpm install
pnpm db:generate
pnpm db:deploy
pnpm db:seed
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

La migración `20261104120000_support_agent` es aditiva: conserva teléfonos,
copia contactos y verifica coincidencias exactas no ambiguas. Los vínculos por
sufijo del teléfono quedan `CLAIMED`. No se adivina el código de país.
El seed conserva artículos existentes. Las once guías nuevas se crean como
borradores; revísalas y publícalas en Base de conocimiento.

El build del panel usa Webpack para evitar el fallo interno de Turbopack al
arrancar el proceso de PostCSS en este entorno de Windows. `build:turbo` conserva
la opción de comprobar Turbopack. Usa una versión LTS de Node, desde 22.12.

Usa una app/número de prueba de Meta. La API no cambia el webhook ni variables
de Railway por su cuenta. Habilita las respuestas en Asistente de soporte.
`WHATSAPP_TEMPLATE_TICKET_STATUS` debe estar aprobada en Meta con código,
asunto y estado. Los avisos de asignación y progreso la reutilizan. La encuesta
solo puede salir como texto dentro de la ventana de 24 horas; fuera requiere
una plantilla que la incluya.

## Identidad y casos

- `UNKNOWN`: pide RUC/empresa, nombre y correo. No diagnostica problemas
  específicos ni expone servicios o tickets. Una búsqueda exige datos aportados
  por el contacto y una coincidencia inequívoca.
- `CLAIMED`: el correo coincide exactamente con una ficha o contacto verificado.
  Puede registrar su incidencia tras confirmar; no consulta historial.
- `VERIFIED`: código al correo de la ficha, teléfono reconocido o confirmación
  manual. Todas las consultas privadas se filtran por ese cliente en el servidor.
- Código de seis dígitos guardado como HMAC, diez minutos de vigencia, cinco
  intentos por código y tres envíos por conversación y hora.
- Verificar manualmente pausa la IA 24 horas. El botón Reanudar IA permite seguir.
- Cada caso conserva hechos, pasos y resultados, resumen, etapa e intentos.
  No permite dos casos abiertos por conversación ni más de dos intentos.
- Resolver requiere confirmación del contacto. Un agradecimiento no basta.
  Un caso sin respuesta en 24 horas se abandona.
- Antes de crear ticket se pide confirmación y horario, salvo urgencia. Incluye
  pasos, diagnósticos, servicio y categoría válidos, responsable y enlace al chat.
  Un ticket abierto del mismo servicio recibe información adicional.
- `PATCH /support/categories/:id/assignment` configura `assigneeId` o `null`.
  Sin regla se elige un administrador activo por menor carga total de tickets.
- Cinco vueltas, dieciséis herramientas y treinta segundos de presupuesto por
  turno; envío y registro ocurren después. Las llamadas iniciadas reciben
  cancelación cuando el proveedor/red lo permiten.
- Diez respuestas y diez diagnósticos por conversación y hora. Una respuesta
  humana pausa la IA. Mensajes y resultados de herramientas son datos no confiables.

El filtro de salida bloquea solicitudes evidentes de credenciales y enlaces a
dominios ajenos. No sustituye evaluaciones de lenguaje natural y supervisión.
El prompt prohíbe revelar notas internas que se usan como contexto.

## Cola y continuidad

El webhook registra mensaje y trabajo en una transacción. Los mensajes renuevan
la espera de seis segundos. El trabajador usa `FOR UPDATE SKIP LOCKED`, un
arrendamiento renovable y una versión. Un mensaje nuevo no se borra al terminar
el anterior. Antes de enviar se comprueban pausa, último mensaje y ventana.
Dos fallos se reintentan; al tercero se intenta el mensaje de espera y se avisa
al equipo. Si Meta sigue caído se conserva el trabajo con espera creciente.
La creación de ticket bloquea el caso dentro de su transacción.

La entrega externa es de al menos una vez: un fallo entre la aceptación del
envío por Meta y su registro puede duplicarlo. No hay una transacción distribuida
ni garantía de entrega exactamente una vez.

## Conocimiento y diagnósticos

Las guías admiten `servicio`, `sintomas`, `preguntas` y `derivar_si` en el encabezado.
Se guardan en `Article.guidance` al sembrar artículos nuevos. Los artículos
generados a partir de resoluciones quedan pendientes de revisión.

La búsqueda combina texto español y fragmentos. Para semántica configura
`AI_EMBEDDING_MODEL` y `OPENROUTER_API_KEY` y pulsa Actualizar búsqueda de guías.
Reindexar consume llamadas al proveedor y no se ejecuta al desplegar.
Los fragmentos modificados no reutilizan vectores viejos.
El modo portable consulta hasta 2.000 fragmentos indexados. Para más volumen,
habilita pgvector con `apps/api/prisma/optional/enable-vector-search.sql` y
`AI_VECTOR_ENABLED=true`. La migración principal no exige extensiones.
La búsqueda de texto sigue disponible si falla el servicio semántico.

Los diagnósticos comprueban HTTP, latencia, contenido básico, redirecciones,
SSL, A/MX/NS, SPF, DMARC, DKIM con selector, RDAP y TCP de correo. Caché de cinco
minutos. Una consulta fallida se declara como tal. `AI_DNSBL_ZONES` habilita
solo las zonas cuyo uso autorice su proveedor. Sin respuesta no implica IP limpia.

`PATCH /support/projects/:id/technical` configura `hostingProvider`, `expectedIp`,
`expectedNameservers` y `dkimSelector`; no admite secretos. Las conexiones
verifican IP pública durante la resolución, incluidos saltos HTTP e IPv4 mapeada
en IPv6. Se usan 80/443 y 465/587/993 hacia el MX público.
`AI_MONITOR_ENABLED=true` revisa servicios activos cada diez minutos y registra
un incidente por host tras dos fallos consecutivos.

## Audios e imágenes

```dotenv
AI_MEDIA_ENABLED=true
AI_TRANSCRIPTION_URL=https://TU_PROVEEDOR/v1/audio/transcriptions
AI_TRANSCRIPTION_KEY=REEMPLAZAR_EN_EL_ENTORNO
AI_TRANSCRIPTION_MODEL=whisper-1
UPLOADS_DIR=/app/uploads
AI_MEDIA_RETENTION_DAYS=90
```

Monta `UPLOADS_DIR` en un volumen persistente. Los Dockerfiles incluyen FFmpeg
y `ffprobe`; en desarrollo local deben estar instalados y en PATH.
Se valida host, firma, MIME y máximo cinco MB. Audio OGG, MP3, MP4 y AAC de
hasta tres minutos; imágenes PNG, JPEG y WebP. Otros documentos quedan descritos
para una persona. Los archivos se sirven solo a administradores autenticados
y se borran tras el plazo configurado. Las transcripciones permanecen como
mensajes; acuerda con CONIT la retención de conversaciones y uso de datos.

## Métricas y evaluación

`ai_turns` registra modelo, latencia, tokens, costo conocido, errores y auditoría
de herramientas: nombre, campos utilizados, resultado y duración, sin códigos
ni argumentos privados. El panel muestra treinta días y valoraciones del equipo.

OpenRouter puede informar costo. Con Anthropic configura
`AI_INPUT_USD_PER_MILLION` y `AI_OUTPUT_USD_PER_MILLION` para estimarlo.
Las tarifas de caché, visión, transcripción y embeddings pueden diferir y esas
llamadas auxiliares no están incluidas en el total del agente.
`AI_DAILY_BUDGET_USD` es orientativo sobre consumo registrado; configura además
el límite global de gasto en la cuenta del proveedor. Al 80 % se avisa al equipo.
Tres turnos fallidos consecutivos también generan aviso.

```bash
pnpm --filter @conit/api test
pnpm --filter @conit/api ai:evaluate --help
pnpm --filter @conit/api ai:evaluate tests/fixtures/support-evaluations.json tmp/evaluation.json
```

Las pruebas usan proveedores simulados y PostgreSQL embebido. La evaluación
real hace llamadas de pago. Incluye treinta escenarios sintéticos; añade entre
treinta y cincuenta conversaciones reales anonimizadas para comparar modelos.
Compilar y probar localmente no acredita entrega de correo/WhatsApp ni acceso
a un modelo externo: valida esas conexiones en el entorno de prueba.
