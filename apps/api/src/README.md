# Arquitectura de `apps/api`

## Estructura actual

```text
src/
├── main.ts                  # Arranque: seguridad, CORS, pipes, Swagger
├── swagger.ts               # Configuracion de OpenAPI
├── app.module.ts            # Modulo raiz: guards, filtros e interceptores globales
├── config/                  # Carga y validacion tipada del entorno
├── common/                  # Piezas transversales (sin logica de dominio)
│   ├── constants/
│   ├── decorators/          # @Public, @Roles, @CurrentUser, @ResponseMessage
│   ├── dto/                 # Envoltura de respuesta documentada en Swagger
│   ├── filters/             # GlobalExceptionFilter
│   ├── guards/              # RolesGuard
│   ├── interceptors/        # ResponseInterceptor
│   ├── interfaces/
│   └── utils/
├── database/                # PrismaModule + PrismaService (global)
├── health/                  # GET /health con verificacion de PostgreSQL
├── users/                   # Dominio de usuarios
├── auth/                    # Autenticacion (JWT + refresh + sesiones)
└── ai/                      # Solo el contrato; ver ai/README.md
```

## Convencion para modulos nuevos (Fase 2 en adelante)

Cada modulo de dominio vive en `src/<modulo>/` y sigue siempre la misma forma:

```text
tickets/
├── tickets.module.ts        # Declara controladores, servicios y exports
├── tickets.controller.ts    # Solo traduce HTTP: sin logica de negocio
├── tickets.service.ts       # Logica de negocio; usa PrismaService
├── tickets.mapper.ts        # Entidad Prisma -> DTO publico (lista blanca)
├── dto/
│   ├── create-ticket.dto.ts
│   ├── update-ticket.dto.ts
│   └── ticket-response.dto.ts
└── guards/ | decorators/    # Solo si son especificos del modulo
```

Modulos previstos: `tickets`, `clients`, `projects`, `categories`,
`conversations`, `notifications`, `knowledge-base`, `reports`, `audit`, `ai`.

## Reglas

- **Los controladores no contienen logica de negocio.** Reciben, delegan y
  devuelven. Toda decision vive en un servicio.
- **Nada lee `process.env` directamente.** La configuracion se obtiene con
  `ConfigService<AppConfig, true>`.
- **Nada instancia `PrismaClient`.** Se inyecta `PrismaService`.
- **Toda entidad se expone mediante un mapper con lista blanca**, nunca con un
  spread del registro de Prisma: asi una columna sensible nueva no se filtra
  por olvido.
- **Los endpoints nacen protegidos.** `JwtAuthGuard` es global; abrir una ruta
  exige `@Public()` de forma explicita.
- **Los controladores devuelven la carga util**, no la envoltura: de eso se
  encarga `ResponseInterceptor`.
- **Los errores no se formatean a mano.** Se lanzan excepciones de Nest y
  `GlobalExceptionFilter` las traduce al contrato de la API.
