#!/bin/bash

# Скрипт для настройки Firewall для работы с Cloudflare
# Использование: sudo ./setup-cloudflare-firewall.sh

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
    error "Пожалуйста, запустите скрипт с правами root (sudo ./setup-cloudflare-firewall.sh)"
    exit 1
fi

info "Настройка Firewall для Cloudflare"
echo ""

# Создаем директорию для IP Cloudflare
CF_DIR="/etc/cloudflare"
mkdir -p "$CF_DIR"

# Скачиваем список IP Cloudflare
info "Шаг 1: Получение списка IP адресов Cloudflare..."

if [ ! -f "$CF_DIR/cloudflare-ips-v4.txt" ]; then
    info "Скачиваю IPv4 адреса Cloudflare..."
    curl -s https://www.cloudflare.com/ips-v4 -o "$CF_DIR/cloudflare-ips-v4.txt"
    info "✓ IPv4 адреса сохранены"
else
    info "✓ Список IPv4 адресов уже существует"
fi

if [ ! -f "$CF_DIR/cloudflare-ips-v6.txt" ]; then
    info "Скачиваю IPv6 адреса Cloudflare..."
    curl -s https://www.cloudflare.com/ips-v6 -o "$CF_DIR/cloudflare-ips-v6.txt" 2>/dev/null || warn "IPv6 адреса недоступны (это нормально)"
fi

# Проверка установки UFW
info "Шаг 2: Проверка UFW..."
if ! command -v ufw &> /dev/null; then
    warn "UFW не установлен. Устанавливаю..."
    apt-get update
    apt-get install -y ufw
else
    info "✓ UFW установлен"
fi

# Проверяем, включен ли firewall
UFW_STATUS=$(ufw status | head -n 1)

info "Шаг 3: Настройка правил firewall..."

# ВАЖНО: Сначала разрешаем SSH, чтобы не заблокировать себя
if ! ufw status | grep -q "22/tcp.*ALLOW"; then
    info "Разрешаю SSH (порт 22)..."
    ufw allow 22/tcp
    info "✓ SSH разрешен"
else
    info "✓ SSH уже разрешен"
fi

# Вопрос о режиме работы
echo ""
warn "Выберите режим работы firewall:"
echo "  1) Разрешить доступ только с IP Cloudflare (рекомендуется, более безопасно)"
echo "  2) Разрешить доступ всем на порты 80/443 (проще, но менее безопасно)"
echo ""
read -p "Ваш выбор (1 или 2): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[1]$ ]]; then
    # Режим 1: Только Cloudflare IP
    info "Настраиваю firewall для работы только с Cloudflare IP..."
    
    # Удаляем старые правила для портов 80 и 443 (если есть)
    ufw delete allow 80/tcp 2>/dev/null || true
    ufw delete allow 443/tcp 2>/dev/null || true
    
    # Добавляем правила для каждого IP Cloudflare
    info "Добавляю правила для IPv4 адресов Cloudflare..."
    while IFS= read -r ip; do
        if [ -n "$ip" ]; then
            ufw allow from "$ip" to any port 80 proto tcp 2>/dev/null || true
            ufw allow from "$ip" to any port 443 proto tcp 2>/dev/null || true
        fi
    done < "$CF_DIR/cloudflare-ips-v4.txt"
    
    info "✓ Правила для Cloudflare IPv4 добавлены"
    
    # IPv6 (если доступен)
    if [ -f "$CF_DIR/cloudflare-ips-v6.txt" ]; then
        info "Добавляю правила для IPv6 адресов Cloudflare..."
        while IFS= read -r ip; do
            if [ -n "$ip" ]; then
                ufw allow from "$ip" to any port 80 proto tcp 2>/dev/null || true
                ufw allow from "$ip" to any port 443 proto tcp 2>/dev/null || true
            fi
        done < "$CF_DIR/cloudflare-ips-v6.txt"
        info "✓ Правила для Cloudflare IPv6 добавлены"
    fi
    
    warn "⚠ ВАЖНО: Прямой доступ к серверу по IP будет заблокирован"
    warn "⚠ Доступ возможен только через Cloudflare"
    
elif [[ $REPLY =~ ^[2]$ ]]; then
    # Режим 2: Разрешить всем
    info "Настраиваю firewall для открытого доступа на порты 80/443..."
    
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    info "✓ Порты 80 и 443 открыты для всех"
    warn "⚠ Прямой доступ к серверу по IP разрешен"
    
else
    error "Неверный выбор. Выход."
    exit 1
fi

# Включаем firewall (если еще не включен)
if [[ "$UFW_STATUS" != *"Status: active"* ]]; then
    info "Включаю firewall..."
    echo "y" | ufw enable
    info "✓ Firewall включен"
else
    info "✓ Firewall уже включен"
fi

# Показываем статус
echo ""
info "Текущий статус firewall:"
ufw status verbose

echo ""
echo "=========================================="
echo "  Firewall настроен!"
echo "=========================================="
echo ""
info "Полезные команды:"
echo "  sudo ufw status              - Статус firewall"
echo "  sudo ufw status numbered     - Правила с номерами"
echo "  sudo ufw delete [номер]      - Удалить правило"
echo "  sudo ufw disable             - Отключить firewall"
echo "  sudo ufw enable              - Включить firewall"
echo ""
info "Для обновления списка IP Cloudflare:"
echo "  sudo curl -s https://www.cloudflare.com/ips-v4 -o $CF_DIR/cloudflare-ips-v4.txt"
echo ""


