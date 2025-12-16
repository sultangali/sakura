#!/bin/bash

# Скрипт для настройки SSL/HTTPS через Cloudflare Origin Certificate
# Использование: sudo ./setup-cloudflare-ssl.sh [domain]
# Пример: sudo ./setup-cloudflare-ssl.sh oxxooy.online
#
# ПЕРЕД ЗАПУСКОМ:
# 1. Получите Origin Certificate в панели Cloudflare
# 2. Сохраните сертификат и приватный ключ в файлы:
#    - /etc/nginx/ssl/oxxooy.online/cert.pem
#    - /etc/nginx/ssl/oxxooy.online/key.pem

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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
    error "Пожалуйста, запустите скрипт с правами root (sudo ./setup-cloudflare-ssl.sh)"
    exit 1
fi

# Получаем домен из аргумента или используем по умолчанию
DOMAIN="${1:-oxxooy.online}"

info "Настройка SSL для домена: $DOMAIN"
echo ""

# Проверка существования сертификатов
SSL_DIR="/etc/nginx/ssl/$DOMAIN"
CERT_FILE="$SSL_DIR/cert.pem"
KEY_FILE="$SSL_DIR/key.pem"

if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
    error "Сертификаты не найдены!"
    echo ""
    info "Инструкция по получению Cloudflare Origin Certificate:"
    echo "  1. Войдите в панель Cloudflare"
    echo "  2. SSL/TLS → Origin Server → Create Certificate"
    echo "  3. Скопируйте сертификат и приватный ключ"
    echo "  4. Сохраните их в файлы:"
    echo "     $CERT_FILE"
    echo "     $KEY_FILE"
    echo ""
    info "Создаю директорию для сертификатов..."
    mkdir -p "$SSL_DIR"
    echo ""
    warn "После сохранения сертификатов запустите скрипт снова:"
    echo "  sudo ./setup-cloudflare-ssl.sh $DOMAIN"
    exit 1
fi

info "✓ Сертификаты найдены"

# Проверка прав доступа
info "Проверка прав доступа к сертификатам..."
chmod 600 "$KEY_FILE"
chmod 644 "$CERT_FILE"
chown root:root "$CERT_FILE" "$KEY_FILE"
info "✓ Права доступа установлены"

# Проверка конфигурации Nginx
info "Проверка конфигурации Nginx..."
NGINX_CONFIG="/etc/nginx/sites-available/platonus"

if [ ! -f "$NGINX_CONFIG" ]; then
    error "Конфигурация Nginx не найдена: $NGINX_CONFIG"
    error "Сначала запустите deploy.sh для настройки Nginx"
    exit 1
fi

# Проверяем, что домен указан в server_name
if ! grep -q "server_name.*$DOMAIN" "$NGINX_CONFIG"; then
    warn "Домен $DOMAIN не найден в конфигурации Nginx"
    warn "Обновляю конфигурацию..."
    sed -i "s|server_name.*|server_name $DOMAIN www.$DOMAIN 34.88.233.59 _;|g" "$NGINX_CONFIG"
fi

# Создаем резервную копию конфигурации
BACKUP_FILE="${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$NGINX_CONFIG" "$BACKUP_FILE"
info "Резервная копия создана: $BACKUP_FILE"

# Проверяем, есть ли уже HTTPS конфигурация
if grep -q "listen 443" "$NGINX_CONFIG"; then
    warn "HTTPS конфигурация уже существует"
    read -p "Перезаписать? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        info "Отменено"
        exit 0
    fi
    # Восстанавливаем из резервной копии
    cp "$BACKUP_FILE" "$NGINX_CONFIG"
fi

# Создаем новую конфигурацию с HTTPS
info "Создание конфигурации с HTTPS..."

# Читаем текущую конфигурацию
CURRENT_CONFIG=$(cat "$NGINX_CONFIG")

# Извлекаем upstream блок
UPSTREAM_BLOCK=$(echo "$CURRENT_CONFIG" | sed -n '/^upstream/,/^}/p')

# Создаем новую конфигурацию
cat > "$NGINX_CONFIG" << EOF
# Platonus Test System - Nginx Configuration with SSL
# Файл: /etc/nginx/sites-available/platonus

$UPSTREAM_BLOCK

# HTTP - редирект на HTTPS
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN 34.88.233.59 _;
    
    # Редирект на HTTPS
    return 301 https://\$host\$request_uri;
}

# HTTPS - основной сервер
server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN 34.88.233.59 _;

    # SSL сертификаты
    ssl_certificate $CERT_FILE;
    ssl_certificate_key $KEY_FILE;

    # SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

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
        root /var/www/platonus/client;
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
        alias /var/www/platonus/server/uploads;
        expires 1y;
        add_header Cache-Control "public" always;
        add_header Access-Control-Allow-Origin * always;
        
        # Разрешаем доступ ко всем типам файлов
        try_files \$uri =404;
        
        # Логирование для отладки
        access_log on;
    }

    # Безопасность заголовков
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
EOF

info "✓ Конфигурация создана"

# Проверка конфигурации
info "Проверка конфигурации Nginx..."
if nginx -t; then
    info "✓ Конфигурация корректна"
else
    error "✗ Ошибка в конфигурации Nginx"
    error "Восстанавливаю резервную копию..."
    cp "$BACKUP_FILE" "$NGINX_CONFIG"
    exit 1
fi

# Перезагрузка Nginx
info "Перезагрузка Nginx..."
systemctl reload nginx || systemctl restart nginx

if [ $? -eq 0 ]; then
    info "✓ Nginx перезагружен"
else
    error "✗ Ошибка при перезагрузке Nginx"
    exit 1
fi

# Проверка портов
info "Проверка портов..."
sleep 2

if netstat -tuln | grep -q ":443 "; then
    info "✓ Nginx слушает на порту 443"
else
    warn "⚠ Nginx не отвечает на порту 443"
fi

# Финальная проверка
echo ""
echo "=========================================="
echo "  SSL/HTTPS настроен успешно!"
echo "=========================================="
echo ""
info "🌐 HTTP: http://$DOMAIN (редирект на HTTPS)"
info "🔒 HTTPS: https://$DOMAIN"
info "🔒 HTTPS (www): https://www.$DOMAIN"
echo ""
info "Проверьте работу сайта:"
echo "  curl -I https://$DOMAIN"
echo "  openssl s_client -connect $DOMAIN:443 -servername $DOMAIN"
echo ""
warn "ВАЖНО: Убедитесь, что в Cloudflare установлен режим SSL:"
echo "  SSL/TLS → Overview → Full (strict)"
echo ""
info "Полезные команды:"
echo "  sudo nginx -t                - Проверить конфигурацию"
echo "  sudo systemctl status nginx  - Статус Nginx"
echo "  sudo tail -f /var/log/nginx/platonus_error.log - Логи ошибок"
echo ""

