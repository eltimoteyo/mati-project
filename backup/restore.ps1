# =============================================================================
# CONIT Support — Script de restauración
# =============================================================================
# Uso: ejecutar desde una terminal con pnpm instalado y PostgreSQL corriendo
#
#   1. PostgreSQL debe estar corriendo en localhost:5432
#   2. Ejecutar este script
#   3. Luego: pnpm dev
# =============================================================================

Write-Host "=== CONIT Support - Restauracion ===" -ForegroundColor Cyan

# --- 1. Restaurar base de datos ---
Write-Host "`n[1/2] Restaurando base de datos..." -ForegroundColor Yellow

# Crear rol y base de datos si no existen
$env:PGPASSWORD = "root"
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" "-h" "localhost" "-p" "5432" "-U" "postgres" "-c" "DO `$$BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'conit') THEN CREATE ROLE conit LOGIN PASSWORD 'conit_pass_2026'; ELSE ALTER ROLE conit LOGIN PASSWORD 'conit_pass_2026'; END IF; END `$$; ALTER ROLE conit CREATEDB;" 2>$null

& "C:\Program Files\PostgreSQL\17\bin\psql.exe" "-h" "localhost" "-p" "5432" "-U" "postgres" "-c" "SELECT 'CREATE DATABASE conit_support OWNER conit ENCODING UTF8' WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'conit_support') \gexec" 2>$null

# Restaurar dump
if (Test-Path "C:\proyecto de mejora\backup\conit_backup.dump") {
    Write-Host "  Restaurando dump..." -ForegroundColor Gray
    & "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" "-h" "localhost" "-p" "5432" "-U" "conit" "-d" "conit_support" "C:\proyecto de mejora\backup\conit_backup.dump" 2>$null
    Write-Host "  Dump restaurado." -ForegroundColor Green
} else {
    Write-Host "  No se encontro conit_backup.dump. Ejecutando migraciones..." -ForegroundColor Yellow
}

# --- 2. Instalar dependencias ---
Write-Host "`n[2/2] Instalando dependencias..." -ForegroundColor Yellow
Set-Location "C:\proyecto de mejora\Conit"
pnpm install 2>$null
Write-Host "  Dependencias instaladas." -ForegroundColor Green

# --- 3. Instrucciones ---
Write-Host "`n=== Restauracion completada ===" -ForegroundColor Green
Write-Host ""
Write-Host "Para arrancar:" -ForegroundColor White
Write-Host "  pnpm --filter @conit/api db:migrate" -ForegroundColor Gray
Write-Host "  pnpm --filter @conit/api db:seed" -ForegroundColor Gray
Write-Host "  pnpm --filter @conit/api dev" -ForegroundColor Gray
Write-Host "  pnpm --filter @conit/web dev" -ForegroundColor Gray
Write-Host ""
Write-Host "API:    http://localhost:4000" -ForegroundColor Cyan
Write-Host "Web:    http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Admin:  admin@conit.com / admin_2026_conit" -ForegroundColor Yellow
Write-Host "Cliente: cliente@conit.com / cliente_2026_conit" -ForegroundColor Yellow
