#!/bin/bash

# Скрипт для настройки SSL/HTTPS через Let's Encrypt
# Использование: sudo ./setup-ssl.sh [domain]
# Пример: sudo ./setup-ssl.sh oxxooy.online

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
    error "Пожалуйста, запустите скрипт с правами root (sudo ./setup-ssl.sh)"
    exit 1
fi

# Получаем домен из аргумента или используем по умолчанию
DOMAIN="${1:-oxxooy.online}"

info "Настройка SSL для домена: $DOMAIN"
echo ""

# Проверка, что домен разрешается
info "Проверка DNS записей..."
if ! nslookup "$DOMAIN" > /dev/null 2>&1; then
    error "Домен $DOMAIN не разрешается. Проверьте DNS записи."
    exit 1
fi

DOMAIN_IP=$(dig +short "$DOMAIN" | head -n 1)
SERVER_IP=$(hostname -I | awk '{print $1}')

info "IP домена: $DOMAIN_IP"
info "IP сервера: $SERVER_IP"

if [ "$DOMAIN_IP" != "$SERVER_IP" ] && [ "$DOMAIN_IP" != "34.88.233.59" ]; then
    warn "IP домена не совпадает с IP сервера. Убедитесь, что DNS записи настроены правильно."
    read -p "Продолжить? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Установка Certbot
info "Шаг 1: Установка Certbot..."
if ! command -v certbot &> /dev/null; then
    info "Устанавливаю Certbot..."
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
else
    info "Certbot уже установлен: $(certbot --version)"
fi

# Проверка, что Nginx настроен для домена
info "Шаг 2: Проверка конфигурации Nginx..."
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
    nginx -t && systemctl reload nginx
fi

# Проверка DNS для www поддомена
info "Проверка DNS записей..."
MAIN_DOMAIN_IP=$(dig +short "$DOMAIN" | head -n 1)
WWW_DOMAIN_IP=$(dig +short "www.$DOMAIN" | head -n 1)

USE_WWW=false
if [ -n "$WWW_DOMAIN_IP" ] && [ "$WWW_DOMAIN_IP" = "$MAIN_DOMAIN_IP" ]; then
    info "✓ DNS записи для www.$DOMAIN найдены"
    USE_WWW=true
else
    warn "⚠ DNS запись для www.$DOMAIN не найдена или не совпадает"
    warn "Буду получать сертификат только для $DOMAIN"
    warn "После настройки DNS для www можно добавить его командой:"
    warn "  sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --expand"
fi

# Получение SSL сертификата
info "Шаг 3: Получение SSL сертификата от Let's Encrypt..."
info "Это может занять несколько минут..."

if [ "$USE_WWW" = true ]; then
    certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --email "admin@$DOMAIN" --redirect
else
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "admin@$DOMAIN" --redirect
fi

if [ $? -eq 0 ]; then
    info "✓ SSL сертификат успешно получен и настроен!"
    if [ "$USE_WWW" = false ]; then
        warn "⚠ Сертификат получен только для $DOMAIN"
        warn "После настройки DNS для www.$DOMAIN выполните:"
        warn "  sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --expand"
    fi
else
    error "✗ Ошибка при получении SSL сертификата"
    error "Проверьте DNS записи и доступность домена из интернета"
    exit 1
fi

# Проверка автоматического обновления
info "Шаг 4: Проверка автоматического обновления сертификата..."
certbot renew --dry-run

if [ $? -eq 0 ]; then
    info "✓ Автоматическое обновление настроено"
else
    warn "⚠ Не удалось проверить автоматическое обновление"
fi

# Финальная проверка
info "Шаг 5: Финальная проверка..."
nginx -t && systemctl reload nginx

echo ""
echo "=========================================="
echo "  SSL/HTTPS настроен успешно!"
echo "=========================================="
echo ""
info "🌐 HTTP: http://$DOMAIN"
info "🔒 HTTPS: https://$DOMAIN"
info "🔒 HTTPS (www): https://www.$DOMAIN"
echo ""
info "Проверьте работу сайта:"
echo "  curl -I https://$DOMAIN"
echo ""
info "Полезные команды:"
echo "  sudo certbot certificates     - Просмотр сертификатов"
echo "  sudo certbot renew            - Обновить сертификаты вручную"
echo "  sudo certbot renew --dry-run   - Тест обновления"
echo ""

