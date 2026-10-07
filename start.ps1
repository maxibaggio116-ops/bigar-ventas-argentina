# Bigar S.A. — Sistema de Gestión de Ventas
# Script de inicio para Windows (PowerShell)

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Bigar S.A. — Sistema de Ventas"

Write-Host ""
Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host "   Bigar S.A. — Sistema de Ventas" -ForegroundColor Cyan
Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
try {
    $nodeVersion = & node --version 2>&1
    Write-Host "  Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Node.js no encontrado." -ForegroundColor Red
    Write-Host "  Instalalo desde https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "  Presiona Enter para salir"
    exit 1
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

# Install backend
Write-Host "  [1/4] Instalando dependencias del backend..." -ForegroundColor Yellow
Set-Location $backend
& npm install --silent
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] Fallo la instalacion del backend." -ForegroundColor Red
    Read-Host "  Presiona Enter para salir"
    exit 1
}

# Install frontend
Write-Host "  [2/4] Instalando dependencias del frontend..." -ForegroundColor Yellow
Set-Location $frontend
& npm install --silent
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] Fallo la instalacion del frontend." -ForegroundColor Red
    Read-Host "  Presiona Enter para salir"
    exit 1
}

# Database setup
Write-Host "  [3/4] Configurando base de datos..." -ForegroundColor Yellow
Set-Location $backend
& npx prisma db push --accept-data-loss 2>&1 | Out-Null
Write-Host "  Base de datos lista." -ForegroundColor Green

# Start servers
Write-Host "  [4/4] Iniciando servidores..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  Backend : http://localhost:3001" -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""

$backendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$backend'; npm run dev" -PassThru -WindowStyle Normal
$frontendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$frontend'; npm run dev" -PassThru -WindowStyle Normal

Write-Host "  Servidores iniciados (PIDs: Backend=$($backendProcess.Id), Frontend=$($frontendProcess.Id))" -ForegroundColor Green
Write-Host ""
Write-Host "  Presiona Enter para abrir el navegador, o Ctrl+C para salir." -ForegroundColor Gray
Read-Host

# Open browser
Start-Process "http://localhost:5173"
