@echo off
title Platonus Client - Local Server Mode

echo ==========================================
echo   Platonus Client - Local Server Mode
echo ==========================================
echo.
echo Клиент будет работать на localhost:5173
echo и обращаться к локальному серверу: localhost:5000
echo.
echo ВНИМАНИЕ: Убедитесь, что локальный сервер запущен!
echo.

cd /d "%~dp0"

REM Переходим в директорию client
if not exist "client" (
    echo [ERROR] Директория client не найдена!
    echo Убедитесь, что вы запускаете скрипт из корня проекта.
    pause
    exit /b 1
)

cd client

REM Создаем .env.local для работы с локальным сервером
echo Создаю .env.local для работы с локальным сервером...
(
    echo # Локальная разработка с локальным сервером
    echo # Измените VITE_SERVER_MODE на 'cloud' для работы с облачным сервером
    echo VITE_SERVER_IP=34.88.233.59
    echo VITE_LOCAL_PORT=5000
    echo VITE_SERVER_MODE=local
) > .env.local

echo.
echo [INFO] Конфигурация создана:
echo   - VITE_SERVER_IP=34.88.233.59
echo   - VITE_FORCE_LOCAL=true
echo.

REM Проверяем, установлены ли зависимости
if not exist "node_modules" (
    echo [INFO] Устанавливаю зависимости...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Ошибка установки зависимостей!
        pause
        exit /b 1
    )
)

echo.
echo [INFO] Запускаю клиент...
echo [INFO] Клиент будет доступен на: http://localhost:5173
echo [INFO] API запросы будут идти на: http://localhost:5000
echo.
echo Нажмите Ctrl+C для остановки
echo.

REM Запускаем клиент
call npm run dev

pause

