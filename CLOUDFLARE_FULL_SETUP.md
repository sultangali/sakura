# Полная настройка Cloudflare SSL для oxxooy.online

## 🎯 Цель

Переход с Let's Encrypt на Cloudflare Origin Certificate для работы через Cloudflare CDN и обхода блокировок университета.

---

## ✅ ШАГ 1. Подключение домена к Cloudflare

### 1.1. Регистрация и добавление домена

1. Зайдите на [cloudflare.com](https://www.cloudflare.com)
2. Создайте аккаунт или войдите
3. Нажмите **Add a Site**
4. Введите `oxxooy.online`
5. Выберите план **Free**
6. Cloudflare просканирует DNS записи - подтвердите

### 1.2. Замена NS-серверов в Namecheap

Cloudflare предоставит вам два NS-сервера (например):
- `alice.ns.cloudflare.com`
- `bob.ns.cloudflare.com`

**В Namecheap:**
1. Domain List → **oxxooy.online** → **Manage**
2. В разделе **Nameservers** выберите **Custom DNS**
3. Введите NS-серверы от Cloudflare:
   - `alice.ns.cloudflare.com`
   - `bob.ns.cloudflare.com`
4. Сохраните изменения
5. Подождите **5-15 минут** (иногда до часа)

---

## ✅ ШАГ 2. DNS-настройки в Cloudflare

### 2.1. Настройка A записей

1. В Cloudflare: **DNS** → **Records**
2. Удалите старые записи (если есть)
3. Добавьте две A записи:

   **Запись 1:**
   - **Type**: `A`
   - **Name**: `oxxooy.online` (или `@`)
   - **IPv4 address**: `34.88.233.59`
   - **Proxy status**: `Proxied` 🟠 (оранжевое облако) ✅
   - **TTL**: `Auto`
   - **Save**

   **Запись 2:**
   - **Type**: `A`
   - **Name**: `www`
   - **IPv4 address**: `34.88.233.59`
   - **Proxy status**: `Proxied` 🟠 (оранжевое облако) ✅
   - **TTL**: `Auto`
   - **Save**

**⚠️ ВАЖНО**: Оранжевое облако (Proxied) должно быть **ВКЛЮЧЕНО** - это ключевой момент!

---

## ✅ ШАГ 3. Получение Origin Certificate

### 3.1. Создание сертификата в Cloudflare

1. В Cloudflare: **SSL/TLS** → **Origin Server**
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

### 3.2. Сохранение сертификата на сервере

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

---

## ✅ ШАГ 4. Настройка Nginx для Cloudflare SSL

### 4.1. Автоматическая настройка (рекомендуется)

```bash
cd /home/sultangali/Documents/platonus-buketov
sudo ./setup-cloudflare-ssl.sh oxxooy.online
```

### 4.2. Ручная настройка (если нужно)

Скрипт автоматически создаст конфигурацию, но если нужно вручную:

```bash
sudo nano /etc/nginx/sites-available/platonus
```

Убедитесь, что конфигурация содержит:

```nginx
# HTTP - редирект на HTTPS
server {
    listen 80;
    server_name oxxooy.online www.oxxooy.online 34.88.233.59 _;
    return 301 https://$host$request_uri;
}

# HTTPS - основной сервер
server {
    listen 443 ssl http2;
    server_name oxxooy.online www.oxxooy.online 34.88.233.59 _;

    # Cloudflare Origin Certificate
    ssl_certificate /etc/nginx/ssl/oxxooy.online/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/oxxooy.online/key.pem;

    # SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # ... остальная конфигурация ...
}
```

Проверьте и перезагрузите:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## ✅ ШАГ 5. Настройка SSL режима в Cloudflare

### 5.1. Установка режима Full (strict)

1. В Cloudflare: **SSL/TLS** → **Overview**
2. Выберите режим: **Full (strict)** ✅

**Почему Full (strict):**
- ✅ У вас есть Origin Certificate на сервере
- ✅ Самый безопасный режим
- ✅ Университетские сети ему доверяют

### 5.2. Включение авто-HTTPS

1. В Cloudflare: **SSL/TLS** → **Edge Certificates**
2. Включите:
   - ✅ **Always Use HTTPS**
   - ✅ **Automatic HTTPS Rewrites**

---

## ✅ ШАГ 6. Настройка Firewall для Cloudflare IP

### 6.1. Получение списка IP Cloudflare

```bash
# Скачиваем список IP Cloudflare
sudo mkdir -p /etc/cloudflare
cd /etc/cloudflare

# IPv4 адреса Cloudflare
sudo curl -s https://www.cloudflare.com/ips-v4 -o cloudflare-ips-v4.txt

# IPv6 адреса Cloudflare (если нужны)
sudo curl -s https://www.cloudflare.com/ips-v6 -o cloudflare-ips-v6.txt
```

### 6.2. Настройка UFW для Cloudflare

```bash
# Разрешаем SSH (важно сделать ПЕРВЫМ!)
sudo ufw allow 22/tcp

# Разрешаем порты 80 и 443 только для Cloudflare IP
sudo ufw allow from $(cat /etc/cloudflare/cloudflare-ips-v4.txt | tr '\n' ',' | sed 's/,$//') to any port 80
sudo ufw allow from $(cat /etc/cloudflare/cloudflare-ips-v4.txt | tr '\n' ',' | sed 's/,$//') to any port 443

# Или проще - разрешаем всем (если Cloudflare IP меняются часто)
# sudo ufw allow 80/tcp
# sudo ufw allow 443/tcp

# Включаем firewall
sudo ufw enable

# Проверяем статус
sudo ufw status verbose
```

### 6.3. Альтернатива: Скрипт для автоматической настройки

Используйте готовый скрипт:

```bash
cd /home/sultangali/Documents/platonus-buketov
sudo ./setup-cloudflare-firewall.sh
```

---

## ✅ ШАГ 7. Проверка работы

### 7.1. Проверка на сервере

```bash
# Проверка конфигурации Nginx
sudo nginx -t

# Проверка статуса Nginx
sudo systemctl status nginx

# Проверка портов
sudo netstat -tuln | grep -E ':(80|443) '

# Проверка сертификата
openssl s_client -connect oxxooy.online:443 -servername oxxooy.online
```

### 7.2. Проверка через браузер

Проверьте сайт с разных сетей:

- 📱 **С мобильного интернета**: `https://oxxooy.online`
- 🏠 **С домашней сети**: `https://oxxooy.online`
- 🎓 **Из сети университета**: `https://oxxooy.online`

### 7.3. Проверка через Cloudflare

1. В Cloudflare: **SSL/TLS** → **Overview**
2. Проверьте статус сертификата
3. Должен быть зеленый индикатор ✅

---

## 🔧 Полезные команды

```bash
# Просмотр логов Nginx
sudo tail -f /var/log/nginx/platonus_error.log
sudo tail -f /var/log/nginx/platonus_access.log

# Перезапуск Nginx
sudo systemctl reload nginx

# Проверка статуса firewall
sudo ufw status

# Обновление списка IP Cloudflare
sudo curl -s https://www.cloudflare.com/ips-v4 -o /etc/cloudflare/cloudflare-ips-v4.txt
```

---

## 🆘 Решение проблем

### Проблема: "SSL Handshake Failed" в Cloudflare

**Решение:**
1. Проверьте, что Origin Certificate правильно сохранен
2. Убедитесь, что режим SSL: **Full (strict)**
3. Проверьте права доступа: `sudo chmod 600 /etc/nginx/ssl/oxxooy.online/key.pem`

### Проблема: Сайт не открывается из университета

**Решение:**
1. Проверьте, что Proxy (оранжевое облако) включен в DNS записях
2. Проверьте режим SSL: **Full (strict)**
3. Проверьте, что Always Use HTTPS включен

### Проблема: 502 Bad Gateway

**Решение:**
1. Проверьте, что сервер запущен: `pm2 status`
2. Проверьте логи: `sudo tail -f /var/log/nginx/platonus_error.log`
3. Проверьте firewall: `sudo ufw status`

---

## ✅ Итоговая проверка

После настройки у вас должно быть:

- ✅ Домен подключен к Cloudflare
- ✅ DNS записи настроены с Proxy (оранжевое облако)
- ✅ Origin Certificate установлен на сервере
- ✅ Nginx настроен для HTTPS
- ✅ Режим SSL: **Full (strict)**
- ✅ Always Use HTTPS включен
- ✅ Firewall настроен (опционально)

---

## 📚 Дополнительные ресурсы

- Подробная инструкция Cloudflare: `CLOUDFLARE_SSL_SETUP.md`
- Быстрый старт: `SSL_QUICK_START.md`
- Настройка firewall: `setup-cloudflare-firewall.sh`


