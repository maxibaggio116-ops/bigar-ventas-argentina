@echo off
chcp 65001 >nul
title Bigar S.A. — Sistema de Ventas

echo.
echo  ================================================
echo   Bigar S.A. — Sistema de Ventas
echo  ================================================
echo.

:: Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Node.js no encontrado.
    echo  Instalalo desde https://nodejs.org/
    pause
    exit /b 1
)

echo  [1/4] Instalando dependencias del backend...
cd /d "%~dp0backend"
call npm install --silent
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Fallo la instalacion del backend.
    pause
    exit /b 1
)

echo  [2/4] Instalando dependencias del frontend...
cd /d "%~dp0frontend"
call npm install --silent
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Fallo la instalacion del frontend.
    pause
    exit /b 1
)

echo  [3/4] Configurando base de datos...
cd /d "%~dp0backend"
call npx prisma db push --accept-data-loss >nul 2>&1
echo  Base de datos lista.

echo  [4/4] Iniciando servidores...
echo.
echo  Backend : http://localhost:3001
echo  Frontend: http://localhost:5173
echo.
echo  Presiona Ctrl+C para detener.
echo.

:: Start backend in new window
start "Bigar Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"

:: Start frontend in new window
start "Bigar Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo  Servidores iniciados en ventanas separadas.
echo.
pause
