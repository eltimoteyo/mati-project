# CONIT Support - Backup

Fecha: 2026-09-21

## Archivos

| Archivo | Descripcion |
|---------|-------------|
| `conit_backup.tar.gz` | Codigo fuente del proyecto (sin node_modules, dist, .git) |
| `conit_backup.dump` | Dump de PostgreSQL (base de datos con datos) |
| `restore.ps1` | Script para restaurar y arrancar |

## Tamaño total: ~19 MB

## Restauracion rapida

```powershell
# 1. Asegurar PostgreSQL corriendo
# 2. Ejecutar restore
.\restore.ps1

# 3. Arrancar
pnpm dev
```

## Credenciales seed
- Admin: admin@conit.com / admin_2026_conit
- Cliente: cliente@conit.com / cliente_2026_conit
