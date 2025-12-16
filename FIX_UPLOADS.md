# Исправление проблемы с загрузкой изображений (404 Not Found)

## Проблема

Изображения не загружаются, возвращается ошибка `404 Not Found`:
```
http://34.88.233.59/uploads/1765770221755-6jjm7v6kv.png
[HTTP/1.1 404 Not Found]
```

## Причины

1. **Файлы находятся в неправильной директории** (dev вместо production)
2. **Неправильные права доступа** к файлам
3. **Неправильная конфигурация Nginx** для `/uploads`
4. **Директория uploads не существует** в production

## Быстрое исправление

### Вариант 1: Автоматический скрипт (рекомендуется)

```bash
# На сервере
cd /path/to/platonus-buketov
sudo ./fix-uploads.sh
```

### Вариант 2: Ручное исправление

#### Шаг 1: Проверьте директорию uploads

```bash
# Проверьте, существует ли директория
ls -la /var/www/platonus/server/uploads

# Если нет, создайте
sudo mkdir -p /var/www/platonus/server/uploads
```

#### Шаг 2: Проверьте файлы

```bash
# Проверьте, есть ли файлы в production директории
ls -la /var/www/platonus/server/uploads/ | head -20

# Если файлов нет, но они есть в dev директории, скопируйте их
# (замените /path/to/platonus-buketov на ваш путь)
sudo cp -r /path/to/platonus-buketov/server/uploads/* /var/www/platonus/server/uploads/
```

#### Шаг 3: Установите права доступа

```bash
# Установите правильные права
sudo chown -R www-data:www-data /var/www/platonus/server/uploads
# или
sudo chown -R nginx:nginx /var/www/platonus/server/uploads

sudo chmod -R 755 /var/www/platonus/server/uploads
```

#### Шаг 4: Обновите конфигурацию Nginx

```bash
# Скопируйте обновленную конфигурацию
sudo cp nginx-platonus.conf /etc/nginx/sites-available/platonus

# Проверьте конфигурацию
sudo nginx -t

# Перезагрузите Nginx
sudo systemctl reload nginx
```

#### Шаг 5: Проверьте работу

```bash
# Найдите любой файл для теста
TEST_FILE=$(ls /var/www/platonus/server/uploads/*.png 2>/dev/null | head -1)

if [ -n "$TEST_FILE" ]; then
    FILENAME=$(basename "$TEST_FILE")
    echo "Тестирую: http://localhost/uploads/$FILENAME"
    curl -I "http://localhost/uploads/$FILENAME"
fi
```

## Проверка конфигурации Nginx

Убедитесь, что в `/etc/nginx/sites-available/platonus` есть:

```nginx
location /uploads {
    alias /var/www/platonus/server/uploads;
    expires 1y;
    add_header Cache-Control "public" always;
    add_header Access-Control-Allow-Origin * always;
    try_files $uri =404;
}
```

**Важно:** Не должно быть вложенных `location` блоков внутри `/uploads`!

## Проверка логов

```bash
# Логи ошибок Nginx
sudo tail -f /var/log/nginx/platonus_error.log

# Логи доступа
sudo tail -f /var/log/nginx/platonus_access.log | grep uploads
```

## Если файлы были загружены до деплоя

Если файлы были загружены в dev директории (`/path/to/platonus-buketov/server/uploads/`), их нужно скопировать в production:

```bash
# Скопируйте все файлы
sudo cp -r /path/to/platonus-buketov/server/uploads/* /var/www/platonus/server/uploads/

# Установите права
sudo chown -R www-data:www-data /var/www/platonus/server/uploads
sudo chmod -R 755 /var/www/platonus/server/uploads
```

## Проверка работы сервера

Убедитесь, что сервер работает из правильной директории:

```bash
# Проверьте, откуда запущен сервер
pm2 info platonus-server

# Должно показать:
# cwd: /var/www/platonus/server
```

Если сервер запущен из другой директории, перезапустите его:

```bash
pm2 delete platonus-server
cd /var/www/platonus/server
pm2 start index.js --name platonus-server --cwd /var/www/platonus/server --env production
pm2 save
```

## Автоматическое исправление при деплое

В будущем, при деплое через `deploy.sh`, файлы из uploads будут создаваться автоматически в production директории при работе сервера. Старые файлы можно скопировать вручную, если нужно.

## Проверка после исправления

1. Откройте браузер: `http://34.88.233.59`
2. Откройте консоль (F12) → Network
3. Попробуйте загрузить страницу с вопросами
4. Проверьте, что запросы к `/uploads/*.png` возвращают `200 OK` (не 404)




