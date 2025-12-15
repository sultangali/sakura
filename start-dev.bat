@echo off
chcp 65001 >nul
title Platonus Test System - Development Mode

echo ==========================================
echo   Platonus Test System - Development
echo ==========================================
echo.

:: Цвета (если поддерживается)
color 0A

:: Проверка Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js не установлен!
    echo Установите Node.js с https://nodejs.org/
    pause
    exit /b 1
)

echo [INFO] Node.js найден: 
node --version
echo.

:: Переход в корневую директорию проекта
cd /d "%~dp0"

:: Проверка существования директорий
if not exist "server" (
    echo [ERROR] Директория server не найдена!
    pause
    exit /b 1
)

if not exist "client" (
    echo [ERROR] Директория client не найдена!
    pause
    exit /b 1
)

:: Проверка node_modules
echo [INFO] Проверка зависимостей...
if not exist "server\node_modules" (
    echo [WARN] Устанавливаю зависимости сервера...
    cd server
    call npm install
    cd ..
)

if not exist "client\node_modules" (
    echo [WARN] Устанавливаю зависимости клиента...
    cd client
    call npm install
    cd ..
)

echo.
echo [INFO] Запуск сервера и клиента...
echo.

:: Создаем временный файл для PID процессов
set SERVER_PID=%TEMP%\platonus_server_pid.txt
set CLIENT_PID=%TEMP%\platonus_client_pid.txt

:: Запускаем сервер в новом окне
echo [INFO] Запуск сервера на http://localhost:5000...
start "Platonus Server" /D "%~dp0server" cmd /k "npm run dev"
timeout /t 3 /nobreak >nul

:: Запускаем клиент в новом окне
echo [INFO] Запуск клиента на http://localhost:5173...
start "Platonus Client" /D "%~dp0client" cmd /k "npm run dev"
timeout /t 5 /nobreak >nul

:: Ждем пока клиент запустится и открываем браузер
echo [INFO] Ожидание запуска клиента...
timeout /t 8 /nobreak >nul

:: Открываем браузер
echo [INFO] Открываю браузер...
start http://localhost:5173

echo.
echo ==========================================
echo   Система запущена!
echo ==========================================
echo.
echo [INFO] Сервер: http://localhost:5000
echo [INFO] Клиент: http://localhost:5173
echo.
echo [INFO] Окна сервера и клиента открыты отдельно
echo [INFO] Для остановки закройте окна сервера и клиента
echo.
echo Нажмите любую клавишу для выхода из этого окна...
pause >nul

