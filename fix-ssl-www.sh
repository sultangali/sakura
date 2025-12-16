#!/bin/bash

# Скрипт для добавления www поддомена к существующему SSL сертификату
# Использование: sudo ./fix-ssl-www.sh [domain]
# Пример: sudo ./fix-ssl-www.sh oxxooy.online

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
    error "Пожалуйста, запустите скрипт с правами root (sudo ./fix-ssl-www.sh)"
    exit 1
fi

# Получаем домен из аргумента или используем по умолчанию
DOMAIN="${1:-oxxooy.online}"

info "Добавление www.$DOMAIN к SSL сертификату"
echo ""

# Проверка DNS для www
info "Проверка DNS записи для www.$DOMAIN..."
WWW_IP=$(dig +short "www.$DOMAIN" | head -n 1)
MAIN_IP=$(dig +short "$DOMAIN" | head -n 1)

if [ -z "$WWW_IP" ]; then
    error "DNS запись для www.$DOMAIN не найдена!"
    echo ""
    info "Настройте DNS запись в вашем DNS провайдере:"
    echo "  Type: A"
    echo "  Name: www"
    echo "  Value: $MAIN_IP"
    echo "  TTL: Automatic"
    echo ""
    info "После настройки подождите 5-30 минут и запустите скрипт снова"
    exit 1
fi

if [ "$WWW_IP" != "$MAIN_IP" ] && [ "$WWW_IP" != "34.88.233.59" ]; then
    error "IP адрес www.$DOMAIN ($WWW_IP) не совпадает с IP основного домена ($MAIN_IP)"
    exit 1
fi

info "✓ DNS запись для www.$DOMAIN найдена: $WWW_IP"

# Проверка существующего сертификата
info "Проверка существующего сертификата..."
if ! certbot certificates | grep -q "$DOMAIN"; then
    error "Сертификат для $DOMAIN не найден"
    error "Сначала получите сертификат: sudo ./setup-ssl.sh $DOMAIN"
    exit 1
fi

# Расширение сертификата
info "Расширение сертификата для включения www.$DOMAIN..."
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --expand --non-interactive

if [ $? -eq 0 ]; then
    info "✓ Сертификат успешно расширен!"
    info "✓ Теперь сертификат работает для $DOMAIN и www.$DOMAIN"
else
    error "✗ Ошибка при расширении сертификата"
    exit 1
fi

# Перезагрузка Nginx
info "Перезагрузка Nginx..."
nginx -t && systemctl reload nginx

echo ""
echo "=========================================="
echo "  SSL сертификат обновлен!"
echo "=========================================="
echo ""
info "🔒 HTTPS: https://$DOMAIN"
info "🔒 HTTPS (www): https://www.$DOMAIN"
echo ""

