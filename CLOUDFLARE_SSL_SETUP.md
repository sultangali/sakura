# Настройка SSL сертификата через Cloudflare

## Варианты SSL сертификатов

### 1. Cloudflare Origin Certificate (Рекомендуется)
- ✅ Бесплатный
- ✅ Выдается на **15 лет**
- ✅ Автоматическое обновление через Cloudflare API
- ✅ Работает только между сервером и Cloudflare (не для прямого доступа)

### 2. Let's Encrypt (Альтернатива)
- ✅ Бесплатный
- ✅ Выдается на **90 дней** (автоматическое обновление)
- ✅ Работает для прямого доступа к серверу

## Настройка Cloudflare Origin Certificate

### Шаг 1: Регистрация домена в Cloudflare

1. Зайдите на [https://www.cloudflare.com](https://www.cloudflare.com)
2. Создайте бесплатный аккаунт или войдите
3. Добавьте домен **oxxooy.online**:
   - Нажмите **Add a Site**
   - Введите `oxxooy.online`
   - Выберите **Free** план
   - Cloudflare автоматически найдет DNS записи

### Шаг 2: Изменение DNS серверов в Namecheap

Cloudflare предоставит вам два DNS сервера (например):
- `alice.ns.cloudflare.com`
- `bob.ns.cloudflare.com`

**В Namecheap:**
1. Domain List → **oxxooy.online** → **Manage**
2. В разделе **Nameservers** выберите **Custom DNS**
3. Введите DNS серверы от Cloudflare:
   - `alice.ns.cloudflare.com`
   - `bob.ns.cloudflare.com`
4. Сохраните изменения
5. Подождите **5-30 минут** для распространения

### Шаг 3: Настройка DNS записей в Cloudflare

1. В панели Cloudflare перейдите в **DNS** → **Records**
2. Добавьте A записи:

   **Запись 1:**
   - Type: `A`
   - Name: `@` (или `oxxooy.online`)
   - IPv4 address: `34.88.233.59`
   - Proxy status: `Proxied` (оранжевое облако) ✅
   - TTL: `Auto`
   - Save

   **Запись 2:**
   - Type: `A`
   - Name: `www`
   - IPv4 address: `34.88.233.59`
   - Proxy status: `Proxied` (оранжевое облако) ✅
   - TTL: `Auto`
   - Save

### Шаг 4: Получение Origin Certificate

1. В панели Cloudflare перейдите в **SSL/TLS** → **Origin Server**
2. Нажмите **Create Certificate**
3. Настройки:
   - **Private key type**: `RSA (2048)`
   - **Hostnames**: 
     - `oxxooy.online`
     - `*.oxxooy.online` (для поддоменов)
   - **Validity**: `15 years`
   - **Certificate Validity Days**: `5475` (15 лет)
4. Нажмите **Create**
5. **Скопируйте оба блока:**
   - **Origin Certificate** (сертификат)
   - **Private Key** (приватный ключ)

### Шаг 5: Сохранение сертификата на сервере

На сервере выполните:

```bash
# Создаем директорию для SSL сертификатов
sudo mkdir -p /etc/nginx/ssl/oxxooy.online

# Создаем файл сертификата
sudo nano /etc/nginx/ssl/oxxooy.online/cert.pem
```

Вставьте **Origin Certificate** (весь блок от `-----BEGIN CERTIFICATE-----` до `-----END CERTIFICATE-----`)

Сохраните: `Ctrl+O`, `Enter`, `Ctrl+X`

```bash
# Создаем файл приватного ключа
sudo nano /etc/nginx/ssl/oxxooy.online/key.pem
```

Вставьте **Private Key** (весь блок от `-----BEGIN PRIVATE KEY-----` до `-----END PRIVATE KEY-----`)

Сохраните: `Ctrl+O`, `Enter`, `Ctrl+X`

```bash
# Устанавливаем правильные права доступа
sudo chmod 600 /etc/nginx/ssl/oxxooy.online/key.pem
sudo chmod 644 /etc/nginx/ssl/oxxooy.online/cert.pem
sudo chown root:root /etc/nginx/ssl/oxxooy.online/*
```

### Шаг 6: Настройка Nginx

Используйте скрипт для автоматической настройки:

```bash
cd /home/sultangali/Documents/platonus-buketov
sudo ./setup-cloudflare-ssl.sh oxxooy.online
```

Или настройте вручную (см. раздел ниже).

### Шаг 7: Настройка SSL режима в Cloudflare

1. В панели Cloudflare: **SSL/TLS** → **Overview**
2. Выберите режим: **Full (strict)** ✅
   - Это обеспечит шифрование между Cloudflare и вашим сервером

### Шаг 8: Проверка

1. Откройте в браузере: `https://oxxooy.online`
2. Должен отображаться зеленый замочек 🔒
3. Проверьте сертификат: `openssl s_client -connect oxxooy.online:443 -servername oxxooy.online`

## Ручная настройка Nginx для Cloudflare SSL

Если хотите настроить вручную, обновите `/etc/nginx/sites-available/platonus`:

```nginx
# HTTP - редирект на HTTPS
server {
    listen 80;
    server_name oxxooy.online www.oxxooy.online 34.88.233.59 _;
    
    # Редирект на HTTPS
    return 301 https://$host$request_uri;
}

# HTTPS - основной сервер
server {
    listen 443 ssl http2;
    server_name oxxooy.online www.oxxooy.online 34.88.233.59 _;

    # SSL сертификаты
    ssl_certificate /etc/nginx/ssl/oxxooy.online/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/oxxooy.online/key.pem;

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
        try_files $uri $uri/ /index.html;
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
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
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
        try_files $uri =404;
        
        # Логирование для отладки
        access_log on;
    }

    # Безопасность заголовков
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}

# Upstream для API сервера
upstream platonus_api {
    server localhost:5000;
    keepalive 64;
}
```

После настройки:

```bash
# Проверка конфигурации
sudo nginx -t

# Перезагрузка Nginx
sudo systemctl reload nginx
```

## Альтернатива: Let's Encrypt (90 дней)

Если предпочитаете Let's Encrypt (90 дней, автоматическое обновление):

```bash
cd /home/sultangali/Documents/platonus-buketov
sudo ./setup-ssl.sh oxxooy.online
```

Это автоматически настроит Let's Encrypt сертификат.

## Преимущества Cloudflare Origin Certificate

1. ✅ **Долгосрочный**: 15 лет (vs 90 дней у Let's Encrypt)
2. ✅ **Бесплатный**: Входит в бесплатный план Cloudflare
3. ✅ **Защита от DDoS**: Cloudflare автоматически защищает ваш сайт
4. ✅ **CDN**: Ускорение загрузки через сеть Cloudflare
5. ✅ **Кеширование**: Автоматическое кеширование статики

## Обновление сертификата

Cloudflare Origin Certificate действителен 15 лет, но если нужно обновить:

1. В панели Cloudflare: **SSL/TLS** → **Origin Server**
2. Нажмите **Create Certificate** (новый)
3. Скачайте новый сертификат
4. Замените файлы на сервере
5. Перезагрузите Nginx: `sudo systemctl reload nginx`

## Проверка работы SSL

```bash
# Проверка сертификата
openssl s_client -connect oxxooy.online:443 -servername oxxooy.online

# Проверка через curl
curl -I https://oxxooy.online

# Проверка через браузер
# Откройте https://oxxooy.online и проверьте замочек 🔒
```

## Решение проблем

### Проблема: "SSL certificate problem"

1. Проверьте, что сертификат правильно сохранен:
   ```bash
   sudo cat /etc/nginx/ssl/oxxooy.online/cert.pem
   sudo cat /etc/nginx/ssl/oxxooy.online/key.pem
   ```

2. Проверьте права доступа:
   ```bash
   sudo chmod 600 /etc/nginx/ssl/oxxooy.online/key.pem
   sudo chmod 644 /etc/nginx/ssl/oxxooy.online/cert.pem
   ```

3. Проверьте конфигурацию Nginx:
   ```bash
   sudo nginx -t
   ```

### Проблема: "502 Bad Gateway"

1. Проверьте, что сервер запущен:
   ```bash
   pm2 status
   ```

2. Проверьте логи:
   ```bash
   sudo tail -f /var/log/nginx/platonus_error.log
   ```

### Проблема: Cloudflare показывает "SSL Handshake Failed"

1. Убедитесь, что SSL режим в Cloudflare: **Full (strict)**
2. Проверьте, что сертификат правильно установлен на сервере
3. Проверьте, что Nginx слушает на порту 443:
   ```bash
   sudo netstat -tuln | grep 443
   ```

## Итоговая конфигурация

После настройки у вас будет:
- ✅ HTTPS: `https://oxxooy.online`
- ✅ Автоматический редирект HTTP → HTTPS
- ✅ Защита от DDoS через Cloudflare
- ✅ Ускорение через CDN Cloudflare
- ✅ SSL сертификат на 15 лет

