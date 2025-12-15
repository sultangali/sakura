#!/bin/bash

# Скрипт для запуска Platonus Test System в режиме разработки
# Использование: ./start-dev.sh

echo "=========================================="
echo "  Platonus Test System - Development"
echo "=========================================="
echo ""

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} Node.js не установлен!"
    echo "Установите Node.js с https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}[INFO]${NC} Node.js найден: $(node --version)"
echo ""

# Переход в корневую директорию
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Проверка директорий
if [ ! -d "server" ]; then
    echo -e "${RED}[ERROR]${NC} Директория server не найдена!"
    exit 1
fi

if [ ! -d "client" ]; then
    echo -e "${RED}[ERROR]${NC} Директория client не найдена!"
    exit 1
fi

# Проверка зависимостей
echo -e "${CYAN}[INFO]${NC} Проверка зависимостей..."

if [ ! -d "server/node_modules" ]; then
    echo -e "${YELLOW}[WARN]${NC} Устанавливаю зависимости сервера..."
    cd server
    npm install
    cd ..
fi

if [ ! -d "client/node_modules" ]; then
    echo -e "${YELLOW}[WARN]${NC} Устанавливаю зависимости клиента..."
    cd client
    npm install
    cd ..
fi

echo ""
echo -e "${CYAN}[INFO]${NC} Запуск сервера и клиента..."
echo ""

# Функция для очистки при выходе
cleanup() {
    echo ""
    echo -e "${YELLOW}[INFO]${NC} Остановка процессов..."
    kill $SERVER_PID $CLIENT_PID 2>/dev/null
    exit
}

trap cleanup INT TERM

# Запуск сервера в фоне
echo -e "${GREEN}[INFO]${NC} Запуск сервера на http://localhost:5000..."
cd server
npm run dev > ../server.log 2>&1 &
SERVER_PID=$!
cd ..

sleep 3

# Запуск клиента в фоне
echo -e "${GREEN}[INFO]${NC} Запуск клиента на http://localhost:5173..."
cd client
npm run dev > ../client.log 2>&1 &
CLIENT_PID=$!
cd ..

# Ждем запуска клиента
echo -e "${CYAN}[INFO]${NC} Ожидание запуска клиента..."
sleep 8

# Открываем браузер (Linux)
if command -v xdg-open &> /dev/null; then
    echo -e "${GREEN}[INFO]${NC} Открываю браузер..."
    xdg-open http://localhost:5173 2>/dev/null
elif command -v open &> /dev/null; then
    # macOS
    open http://localhost:5173
fi

echo ""
echo "=========================================="
echo -e "${GREEN}  Система запущена!${NC}"
echo "=========================================="
echo ""
echo -e "${CYAN}[INFO]${NC} Сервер: http://localhost:5000"
echo -e "${CYAN}[INFO]${NC} Клиент: http://localhost:5173"
echo ""
echo -e "${YELLOW}[INFO]${NC} Логи сервера: tail -f server.log"
echo -e "${YELLOW}[INFO]${NC} Логи клиента: tail -f client.log"
echo ""
echo -e "${YELLOW}[INFO]${NC} Для остановки нажмите Ctrl+C"
echo ""

# Ждем завершения
wait

