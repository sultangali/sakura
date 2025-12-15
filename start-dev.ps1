# PowerShell скрипт для запуска Platonus Test System
# Использование: .\start-dev.ps1

Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Platonus Test System - Development" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

# Проверка Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js не установлен!" -ForegroundColor Red
    Write-Host "Установите Node.js с https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Нажмите Enter для выхода"
    exit 1
}

Write-Host "[INFO] Node.js найден: " -NoNewline
node --version
Write-Host ""

# Переход в корневую директорию
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Проверка директорий
if (-not (Test-Path "server")) {
    Write-Host "[ERROR] Директория server не найдена!" -ForegroundColor Red
    Read-Host "Нажмите Enter для выхода"
    exit 1
}

if (-not (Test-Path "client")) {
    Write-Host "[ERROR] Директория client не найдена!" -ForegroundColor Red
    Read-Host "Нажмите Enter для выхода"
    exit 1
}

# Проверка зависимостей
Write-Host "[INFO] Проверка зависимостей..." -ForegroundColor Cyan

if (-not (Test-Path "server\node_modules")) {
    Write-Host "[WARN] Устанавливаю зависимости сервера..." -ForegroundColor Yellow
    Set-Location server
    npm install
    Set-Location ..
}

if (-not (Test-Path "client\node_modules")) {
    Write-Host "[WARN] Устанавливаю зависимости клиента..." -ForegroundColor Yellow
    Set-Location client
    npm install
    Set-Location ..
}

Write-Host ""
Write-Host "[INFO] Запуск сервера и клиента..." -ForegroundColor Cyan
Write-Host ""

# Запуск сервера
Write-Host "[INFO] Запуск сервера на http://localhost:5000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptPath\server'; npm run dev" -WindowStyle Normal

# Небольшая задержка
Start-Sleep -Seconds 3

# Запуск клиента
Write-Host "[INFO] Запуск клиента на http://localhost:5173..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptPath\client'; npm run dev" -WindowStyle Normal

# Ждем запуска клиента
Write-Host "[INFO] Ожидание запуска клиента..." -ForegroundColor Cyan
Start-Sleep -Seconds 8

# Открываем браузер
Write-Host "[INFO] Открываю браузер..." -ForegroundColor Green
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Система запущена!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "[INFO] Сервер: http://localhost:5000" -ForegroundColor Cyan
Write-Host "[INFO] Клиент: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "[INFO] Окна сервера и клиента открыты отдельно" -ForegroundColor Yellow
Write-Host "[INFO] Для остановки закройте окна сервера и клиента" -ForegroundColor Yellow
Write-Host ""
Write-Host "Нажмите любую клавишу для выхода..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

