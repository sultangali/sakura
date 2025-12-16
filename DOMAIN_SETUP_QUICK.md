# Быстрая настройка домена oxxooy.online

## 📋 Пошаговая инструкция

### 1️⃣ Настройка DNS в Namecheap (5 минут)

1. Войдите в [Namecheap](https://www.namecheap.com) → **Domain List** → **oxxooy.online** → **Manage**
2. Перейдите в **Advanced DNS** → **Host Records**
3. Добавьте две A записи:

   **Запись 1:**
   - Type: `A Record`
   - Host: `@`
   - Value: `34.88.233.59`
   - TTL: `Automatic`
   - ✅ Save

   **Запись 2:**
   - Type: `A Record`
   - Host: `www`
   - Value: `34.88.233.59`
   - TTL: `Automatic`
   - ✅ Save

4. Подождите **5-30 минут** для распространения DNS

### 2️⃣ Проверка DNS (на вашем компьютере)

```bash
# Windows
nslookup oxxooy.online

# Linux/macOS
dig oxxooy.online +short
```

Должен вернуться IP: `34.88.233.59`

### 3️⃣ Деплой на сервере

На сервере выполните:

```bash
cd /home/sultangali/Documents/platonus-buketov
sudo DOMAIN=oxxooy.online ./deploy.sh
```

Скрипт автоматически:
- ✅ Настроит Nginx для домена
- ✅ Пересоберет клиент
- ✅ Перезагрузит сервисы

### 4️⃣ Проверка работы

Откройте в браузере:
- ✅ `http://oxxooy.online` - должен открыться сайт
- ✅ `http://www.oxxooy.online` - должен открыться сайт

### 5️⃣ Настройка HTTPS (опционально, но рекомендуется)

После того как HTTP работает:

```bash
cd /home/sultangali/Documents/platonus-buketov
sudo ./setup-ssl.sh oxxooy.online
```

Это настроит бесплатный SSL сертификат от Let's Encrypt.

После настройки:
- ✅ `https://oxxooy.online` - будет работать с HTTPS
- ✅ `https://www.oxxooy.online` - будет работать с HTTPS

## 🎯 Итоговый результат

После настройки у вас будет:
- ✅ Домен: `oxxooy.online`
- ✅ HTTP: `http://oxxooy.online`
- ✅ HTTPS: `https://oxxooy.online` (после настройки SSL)
- ✅ www версия: `www.oxxooy.online`

## 🔧 Полезные команды

```bash
# Проверка DNS
nslookup oxxooy.online
dig oxxooy.online

# Проверка Nginx
sudo nginx -t
sudo systemctl status nginx

# Логи
sudo tail -f /var/log/nginx/platonus_access.log
pm2 logs platonus-server

# Перезапуск
pm2 restart platonus-server
sudo systemctl reload nginx
```

## ❓ Решение проблем

**Домен не открывается:**
1. Проверьте DNS: `nslookup oxxooy.online`
2. Подождите до 30 минут
3. Очистите DNS кеш на вашем компьютере

**502 Bad Gateway:**
```bash
pm2 restart platonus-server
sudo systemctl reload nginx
```

**SSL не работает:**
```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

## 📚 Подробная документация

- Полная инструкция: `DNS_SETUP.md`
- Деплой: `DEPLOYMENT.md`


