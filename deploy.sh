#!/bin/bash

# Скрипт для развертывания Platonus Test System
# Автоматически настраивает и запускает сервер и клиент через Nginx и PM2

set -e  # Остановка при ошибке

echo "=========================================="
echo "  Platonus Test System - Deployment"
echo "=========================================="
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция для вывода сообщений
info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Проверка прав root
if [ "$EUID" -ne 0 ]; then 
    error "Пожалуйста, запустите скрипт с правами root (sudo ./deploy.sh)"
    exit 1
fi

# Переменные
PROJECT_DIR=$(pwd)
SERVER_DIR="$PROJECT_DIR/server"
CLIENT_DIR="$PROJECT_DIR/client"
DOMAIN="${DOMAIN:-34.88.233.59}"  # IP адрес сервера (можно переопределить через переменную окружения)
SERVER_PORT="${SERVER_PORT:-5000}"
CLIENT_PORT="${CLIENT_PORT:-5173}"

# Директории для production развертывания
WWW_DIR="/var/www/platonus"
WWW_CLIENT_DIR="$WWW_DIR/client"
WWW_SERVER_DIR="$WWW_DIR/server"

info "Проект: $PROJECT_DIR"
info "Домен: $DOMAIN"
info "Порт сервера: $SERVER_PORT"
info "Порт клиента: $CLIENT_PORT"
echo ""

# ============================================
# 1. Установка системных зависимостей
# ============================================
info "Шаг 1: Установка системных зависимостей..."

# Проверка Node.js
if ! command -v node &> /dev/null; then
    warn "Node.js не установлен. Устанавливаю..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
else
    info "Node.js уже установлен: $(node --version)"
fi

# Проверка PM2
if ! command -v pm2 &> /dev/null; then
    warn "PM2 не установлен. Устанавливаю..."
    npm install -g pm2
else
    info "PM2 уже установлен: $(pm2 --version)"
fi

# Проверка Nginx
if ! command -v nginx &> /dev/null; then
    warn "Nginx не установлен. Устанавливаю..."
    apt-get update
    apt-get install -y nginx
else
    info "Nginx уже установлен: $(nginx -v 2>&1)"
fi

# Установка ImageMagick (опционально, для конвертации WMF)
if ! command -v convert &> /dev/null && ! command -v magick &> /dev/null; then
    warn "ImageMagick не установлен. Устанавливаю (опционально)..."
    apt-get install -y imagemagick || warn "Не удалось установить ImageMagick, продолжаю..."
fi

# ============================================
# 2. Установка зависимостей проекта
# ============================================
info "Шаг 2: Установка зависимостей проекта..."

# Сервер
if [ -d "$SERVER_DIR" ]; then
    info "Установка зависимостей сервера..."
    cd "$SERVER_DIR"
    npm install
    cd "$PROJECT_DIR"
else
    error "Директория сервера не найдена: $SERVER_DIR"
    exit 1
fi

# Клиент
if [ -d "$CLIENT_DIR" ]; then
    info "Установка зависимостей клиента..."
    cd "$CLIENT_DIR"
    npm install
    cd "$PROJECT_DIR"
else
    error "Директория клиента не найдена: $CLIENT_DIR"
    exit 1
fi

# ============================================
# 3. Настройка переменных окружения
# ============================================
info "Шаг 3: Настройка переменных окружения..."

# Сервер .env
if [ ! -f "$SERVER_DIR/.env" ]; then
    warn "Создаю .env файл для сервера..."
    cat > "$SERVER_DIR/.env" << EOF
PORT=$SERVER_PORT
MONGODB_URI=mongodb://localhost:27017/platonus
ADMIN_PASSWORD=admin123
EOF
    warn "⚠️  ВАЖНО: Измените пароль админа в $SERVER_DIR/.env"
else
    info ".env файл сервера уже существует"
fi

# Клиент .env (для production сборки)
if [ ! -f "$CLIENT_DIR/.env.production" ]; then
    warn "Создаю .env.production файл для клиента..."
    cat > "$CLIENT_DIR/.env.production" << EOF
# Production режим - облачный сервер
VITE_SERVER_IP=$DOMAIN
VITE_LOCAL_PORT=5000
# Принудительно использовать облачный режим
VITE_FORCE_CLOUD=true
EOF
    info "Настроен .env.production для клиента с адресом: $DOMAIN"
else
    info ".env.production файл клиента уже существует"
    # Обновляем IP в существующем файле
    sed -i "s|VITE_SERVER_IP=.*|VITE_SERVER_IP=$DOMAIN|g" "$CLIENT_DIR/.env.production" 2>/dev/null || echo "VITE_SERVER_IP=$DOMAIN" >> "$CLIENT_DIR/.env.production"
    # Убеждаемся, что FORCE_CLOUD установлен
    if ! grep -q "VITE_FORCE_CLOUD" "$CLIENT_DIR/.env.production"; then
        echo "VITE_FORCE_CLOUD=true" >> "$CLIENT_DIR/.env.production"
    fi
fi

# Клиент .env.local (для локальной разработки)
if [ ! -f "$CLIENT_DIR/.env.local" ]; then
    info "Создаю .env.local файл для локальной разработки..."
    cat > "$CLIENT_DIR/.env.local" << EOF
# Local режим - localhost
VITE_SERVER_IP=localhost
VITE_LOCAL_PORT=5000
EOF
    info "Настроен .env.local для локальной разработки"
fi

# ============================================
# 4. Создание директорий для production
# ============================================
info "Шаг 4: Создание директорий для production..."

# Создаем директории в /var/www
mkdir -p "$WWW_DIR"
mkdir -p "$WWW_CLIENT_DIR"
mkdir -p "$WWW_SERVER_DIR"
mkdir -p "$WWW_SERVER_DIR/uploads"

# Устанавливаем права доступа
chown -R $SUDO_USER:$SUDO_USER "$WWW_DIR" 2>/dev/null || true
chmod -R 755 "$WWW_DIR"

info "Директории созданы: $WWW_DIR"

# ============================================
# 5. Копирование сервера
# ============================================
info "Шаг 5: Копирование сервера в /var/www..."

# Копируем файлы сервера (исключая node_modules и .git)
rsync -av --exclude='node_modules' --exclude='.git' --exclude='uploads/*' "$SERVER_DIR/" "$WWW_SERVER_DIR/" || {
    # Fallback на cp если rsync не доступен
    cp -r "$SERVER_DIR"/* "$WWW_SERVER_DIR/" 2>/dev/null || true
    rm -rf "$WWW_SERVER_DIR/node_modules" 2>/dev/null || true
    rm -rf "$WWW_SERVER_DIR/.git" 2>/dev/null || true
}

# Устанавливаем права на uploads
chmod -R 755 "$WWW_SERVER_DIR/uploads"

info "Сервер скопирован в $WWW_SERVER_DIR"

# ============================================
# 6. Сборка и копирование клиента
# ============================================
info "Шаг 6: Сборка клиента для production..."

cd "$CLIENT_DIR"

# Устанавливаем production переменные
if [ -f ".env.production" ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

npm run build || {
    error "Ошибка сборки клиента"
    exit 1
}

# Копируем собранный клиент в /var/www
if [ -d "dist" ]; then
    cp -r dist/* "$WWW_CLIENT_DIR/" || {
        error "Ошибка копирования клиента"
        exit 1
    }
    info "Клиент собран и скопирован в $WWW_CLIENT_DIR"
else
    error "Директория dist не найдена после сборки"
    exit 1
fi

cd "$PROJECT_DIR"

# ============================================
# 7. Настройка PM2
# ============================================
info "Шаг 7: Настройка PM2 для сервера..."

cd "$WWW_SERVER_DIR"

# Устанавливаем зависимости в production директории
if [ ! -d "node_modules" ]; then
    info "Устанавливаю зависимости сервера в production..."
    npm install --production
fi

# Останавливаем существующий процесс если есть
pm2 delete platonus-server 2>/dev/null || true

# Запускаем сервер через PM2 из production директории
pm2 start index.js --name platonus-server --cwd "$WWW_SERVER_DIR" --env production || {
    error "Ошибка запуска сервера через PM2"
    exit 1
}

# Сохраняем конфигурацию PM2
pm2 save

# Настраиваем автозапуск
pm2 startup systemd -u $SUDO_USER --hp /home/$SUDO_USER || warn "Не удалось настроить автозапуск PM2"

cd "$PROJECT_DIR"

info "Сервер запущен через PM2 из $WWW_SERVER_DIR"

# ============================================
# 8. Настройка Nginx
# ============================================
info "Шаг 8: Настройка Nginx..."

NGINX_CONFIG="/etc/nginx/sites-available/platonus"
NGINX_ENABLED="/etc/nginx/sites-enabled/platonus"

# Копируем конфигурацию из проекта или создаем новую
if [ -f "$PROJECT_DIR/nginx-platonus.conf" ]; then
    info "Использую конфигурацию из проекта..."
    cp "$PROJECT_DIR/nginx-platonus.conf" "$NGINX_CONFIG"
    
    # Заменяем переменные в конфигурации
    sed -i "s|/var/www/platonus|$WWW_DIR|g" "$NGINX_CONFIG"
    sed -i "s|localhost:5000|localhost:$SERVER_PORT|g" "$NGINX_CONFIG"
    sed -i "s|34.88.233.59|$DOMAIN|g" "$NGINX_CONFIG"
else
    # Создаем конфигурацию Nginx
    info "Создаю новую конфигурацию Nginx..."
    cat > "$NGINX_CONFIG" << EOF
# Platonus Test System Nginx Configuration

# Upstream для API сервера
upstream platonus_api {
    server localhost:$SERVER_PORT;
    keepalive 64;
}

server {
    listen 80;
    server_name $DOMAIN _;

    # Логи
    access_log /var/log/nginx/platonus_access.log;
    error_log /var/log/nginx/platonus_error.log;

    # Максимальный размер загружаемых файлов (50MB)
    client_max_body_size 50M;
    
    # Таймауты для больших файлов
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;
    send_timeout 300s;

    # Статические файлы клиента
    location / {
        root $WWW_CLIENT_DIR;
        try_files \$uri \$uri/ /index.html;
        index index.html;
        
        # Кеширование статики
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            access_log off;
        }
        
        # Без кеширования для HTML
        location ~* \.(html)$ {
            expires -1;
            add_header Cache-Control "no-cache, no-store, must-revalidate";
        }
    }

    # API проксирование
    location /api {
        proxy_pass http://platonus_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Увеличиваем буферы для больших запросов
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # Загруженные файлы (изображения)
    location /uploads {
        alias $WWW_SERVER_DIR/uploads;
        expires 1y;
        add_header Cache-Control "public";
        add_header Access-Control-Allow-Origin *;
        
        # Разрешаем доступ к файлам
        location ~* \.(png|jpg|jpeg|gif|svg|pdf|wmf|emf)$ {
            add_header Access-Control-Allow-Origin *;
        }
    }

    # Безопасность заголовков
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
EOF
fi

# Активируем конфигурацию
ln -sf "$NGINX_CONFIG" "$NGINX_ENABLED"

# Удаляем дефолтную конфигурацию если есть
rm -f /etc/nginx/sites-enabled/default

# Проверяем конфигурацию Nginx
nginx -t || {
    error "Ошибка в конфигурации Nginx"
    exit 1
}

# Перезагружаем Nginx
systemctl reload nginx || systemctl restart nginx

info "Nginx настроен и перезагружен"

# ============================================
# 9. Проверка MongoDB
# ============================================
info "Шаг 9: Проверка MongoDB..."

if ! systemctl is-active --quiet mongod 2>/dev/null && ! systemctl is-active --quiet mongodb 2>/dev/null; then
    warn "MongoDB не запущен. Пытаюсь запустить..."
    
    # Пробуем разные варианты названия сервиса
    systemctl start mongod 2>/dev/null || \
    systemctl start mongodb 2>/dev/null || \
    warn "Не удалось запустить MongoDB автоматически. Запустите вручную: sudo systemctl start mongod"
else
    info "MongoDB запущен"
fi

# ============================================
# 10. Финальная проверка
# ============================================
info "Шаг 10: Финальная проверка..."

sleep 2

# Проверка PM2
if pm2 list | grep -q "platonus-server.*online"; then
    info "✓ Сервер работает через PM2"
else
    error "✗ Сервер не запущен через PM2"
    pm2 logs platonus-server --lines 20
fi

# Проверка Nginx
if systemctl is-active --quiet nginx; then
    info "✓ Nginx работает"
else
    error "✗ Nginx не запущен"
fi

# Проверка портов
if netstat -tuln | grep -q ":$SERVER_PORT "; then
    info "✓ Сервер слушает на порту $SERVER_PORT"
else
    warn "⚠ Сервер не отвечает на порту $SERVER_PORT"
fi

if netstat -tuln | grep -q ":80 "; then
    info "✓ Nginx слушает на порту 80"
else
    warn "⚠ Nginx не отвечает на порту 80"
fi

# ============================================
# Итоги
# ============================================
echo ""
echo "=========================================="
echo "  Развертывание завершено!"
echo "=========================================="
echo ""
info "🌐 Сервер API: http://$DOMAIN/api"
info "🌐 Клиент (Production): http://$DOMAIN"
info "📡 IP адрес: $DOMAIN"
info "📊 Статус PM2: pm2 status"
info "Логи сервера: pm2 logs platonus-server"
info "Логи Nginx: tail -f /var/log/nginx/platonus_*.log"
echo ""
info "📋 РЕЖИМЫ РАБОТЫ:"
echo "  ☁️  Облачный режим (Production):"
echo "     - Клиент: http://$DOMAIN"
echo "     - Автоматически определяется по hostname"
echo ""
echo "  🔧 Локальный режим (Development):"
echo "     - Клиент: http://localhost:5173 (npm run dev)"
echo "     - Сервер: http://localhost:5000 (npm run dev)"
echo "     - Автоматически определяется по localhost"
echo ""
warn "ВАЖНО:"
echo "  1. Убедитесь, что MongoDB запущен: sudo systemctl start mongod"
echo "  2. Измените пароль админа в $SERVER_DIR/.env"
echo "  3. Откройте firewall для портов 80 и 443:"
echo "     sudo ufw allow 80/tcp"
echo "     sudo ufw allow 443/tcp"
echo "  4. Для HTTPS настройте SSL сертификат (Let's Encrypt)"
echo ""
info "Полезные команды:"
echo "  pm2 restart platonus-server  - Перезапустить сервер"
echo "  pm2 stop platonus-server     - Остановить сервер"
echo "  pm2 logs platonus-server     - Просмотр логов"
echo "  sudo nginx -t                - Проверить конфигурацию Nginx"
echo "  sudo systemctl reload nginx  - Перезагрузить Nginx"
echo ""
info "Для локальной разработки:"
echo "  cd client && npm run dev     - Запустить клиент локально"
echo "  cd server && npm run dev     - Запустить сервер локально"
echo ""
info "Директории production:"
echo "  Клиент: $WWW_CLIENT_DIR"
echo "  Сервер: $WWW_SERVER_DIR"
echo ""
info "Для повторного развертывания просто запустите скрипт снова:"
echo "  sudo ./deploy.sh"
echo ""
info "Конфигурация Nginx сохранена в: $NGINX_CONFIG"
echo ""

