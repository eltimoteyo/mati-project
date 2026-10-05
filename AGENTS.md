# AGENTS.md

Comandos de verificacion para el monorepo de CONIT Support.

## Lint

```bash
pnpm lint        # Lint de todas las apps y packages
pnpm --filter @conit/api lint      # Solo la API
pnpm --filter @conit/web lint      # Solo el frontend
pnpm --filter @conit/types lint    # Solo tipos compartidos
```

## Typecheck

```bash
pnpm typecheck   # Typecheck de todas las apps y packages
pnpm --filter @conit/api typecheck      # Solo la API
pnpm --filter @conit/web typecheck      # Solo el frontend
pnpm --filter @conit/types typecheck    # Solo tipos compartidos
```

## Base de datos

```bash
pnpm db:generate   # Generar cliente Prisma
pnpm db:migrate    # Crear y aplicar migraciones (modo dev)
pnpm db:seed       # Ejecutar seed
pnpm db:studio     # Abrir Prisma Studio
```

## Build

```bash
pnpm build         # Build de todo el monorepo
```
