#!/bin/bash

# Скрипт для исправления проблемы с загрузкой изображений

echo "=========================================="
echo "  Исправление проблемы с uploads"
echo "=========================================="
echo ""

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

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
    error "Пожалуйста, запустите скрипт с правами root (sudo ./fix-uploads.sh)"
    exit 1
fi

UPLOADS_DIR="/var/www/platonus/server/uploads"
NGINX_CONFIG="/etc/nginx/sites-available/platonus"

echo "1. Проверка директории uploads..."
echo "----------------------------------------"
if [ -d "$UPLOADS_DIR" ]; then
    info "✓ Директория существует: $UPLOADS_DIR"
    FILE_COUNT=$(find "$UPLOADS_DIR" -type f | wc -l)
    info "  Файлов в директории: $FILE_COUNT"
    
    # Показываем несколько примеров файлов
    echo ""
    echo "Примеры файлов:"
    ls -lh "$UPLOADS_DIR" | head -10
else
    warn "⚠ Директория не существует, создаю..."
    mkdir -p "$UPLOADS_DIR"
    info "✓ Директория создана"
fi

echo ""
echo "2. Проверка прав доступа..."
echo "----------------------------------------"
chown -R www-data:www-data "$UPLOADS_DIR" 2>/dev/null || chown -R nginx:nginx "$UPLOADS_DIR" 2>/dev/null || true
chmod -R 755 "$UPLOADS_DIR"
info "✓ Права установлены"

echo ""
echo "3. Проверка конфигурации Nginx..."
echo "----------------------------------------"
if [ -f "$NGINX_CONFIG" ]; then
    # Проверяем, что конфигурация правильная
    if grep -q "alias /var/www/platonus/server/uploads" "$NGINX_CONFIG"; then
        info "✓ Конфигурация Nginx содержит правильный путь"
    else
        warn "⚠ Конфигурация Nginx может быть неправильной"
    fi
    
    # Проверяем синтаксис
    if nginx -t 2>&1 | grep -q "successful"; then
        info "✓ Синтаксис Nginx корректен"
    else
        error "✗ Ошибка в конфигурации Nginx"
        nginx -t
        exit 1
    fi
else
    error "✗ Конфигурация Nginx не найдена: $NGINX_CONFIG"
    exit 1
fi

echo ""
echo "4. Тест доступа к файлу..."
echo "----------------------------------------"
# Ищем любой файл для теста
TEST_FILE=$(find "$UPLOADS_DIR" -type f -name "*.png" -o -name "*.jpg" | head -1)
if [ -n "$TEST_FILE" ]; then
    info "✓ Найден тестовый файл: $(basename $TEST_FILE)"
    if [ -r "$TEST_FILE" ]; then
        info "✓ Файл читаемый"
    else
        error "✗ Файл не читаемый"
        chmod 644 "$TEST_FILE"
    fi
else
    warn "⚠ Тестовые файлы не найдены"
    echo "  Создаю тестовый файл..."
    echo "test" > "$UPLOADS_DIR/test.txt"
    chmod 644 "$UPLOADS_DIR/test.txt"
    info "✓ Тестовый файл создан"
fi

echo ""
echo "5. Перезагрузка Nginx..."
echo "----------------------------------------"
systemctl reload nginx
if [ $? -eq 0 ]; then
    info "✓ Nginx перезагружен"
else
    error "✗ Ошибка перезагрузки Nginx"
    systemctl status nginx
    exit 1
fi

echo ""
echo "6. Проверка через curl..."
echo "----------------------------------------"
if [ -n "$TEST_FILE" ]; then
    FILENAME=$(basename "$TEST_FILE")
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost/uploads/$FILENAME")
    if [ "$HTTP_CODE" = "200" ]; then
        info "✓ Файл доступен через Nginx (HTTP 200)"
    else
        warn "⚠ Файл недоступен (HTTP $HTTP_CODE)"
        echo "  Проверьте логи: tail -f /var/log/nginx/platonus_error.log"
    fi
fi

echo ""
echo "=========================================="
info "Проверка завершена"
echo "=========================================="
echo ""
echo "Полезные команды:"
echo "  ls -la $UPLOADS_DIR              - Список файлов"
echo "  tail -f /var/log/nginx/platonus_error.log  - Логи ошибок"
echo "  curl -I http://localhost/uploads/имя_файла.png  - Тест доступа"
echo ""




