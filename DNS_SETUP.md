# Настройка DNS записей для домена oxxooy.online

## Инструкция по настройке DNS в Namecheap

### Шаг 1: Вход в панель управления Namecheap

1. Перейдите на [https://www.namecheap.com](https://www.namecheap.com)
2. Войдите в свой аккаунт
3. Перейдите в раздел **Domain List** (Список доменов)
4. Найдите домен **oxxooy.online** и нажмите **Manage** (Управление)

### Шаг 2: Настройка DNS записей

1. В разделе **Advanced DNS** (Расширенные DNS) найдите секцию **Host Records** (Записи хостов)

2. **Удалите существующие записи** (если есть):
   - Удалите все A записи, которые могут конфликтовать
   - Оставьте только необходимые записи

3. **Добавьте A записи**:

   #### A запись для основного домена:
   - **Type**: `A Record`
   - **Host**: `@` (или оставьте пустым)
   - **Value**: `34.88.233.59`
   - **TTL**: `Automatic` (или `600` секунд)
   - Нажмите **Save** (Сохранить)

   #### A запись для www поддомена:
   - **Type**: `A Record`
   - **Host**: `www`
   - **Value**: `34.88.233.59`
   - **TTL**: `Automatic` (или `600` секунд)
   - Нажмите **Save** (Сохранить)

### Шаг 3: Проверка DNS записей

После сохранения DNS записей подождите **5-30 минут** для распространения изменений (DNS propagation).

Проверить можно через командную строку:

```bash
# Проверка основного домена
nslookup oxxooy.online

# Проверка www поддомена
nslookup www.oxxooy.online

# Или через dig
dig oxxooy.online
dig www.oxxooy.online
```

Ожидаемый результат:
```
oxxooy.online -> 34.88.233.59
www.oxxooy.online -> 34.88.233.59
```

### Шаг 4: Настройка на сервере

После настройки DNS выполните на сервере:

```bash
cd /path/to/platonus-buketov
sudo DOMAIN=oxxooy.online ./deploy.sh
```

Или если вы уже на сервере:

```bash
cd /home/sultangali/Documents/platonus-buketov
sudo DOMAIN=oxxooy.online ./deploy.sh
```

Скрипт автоматически:
- ✅ Обновит конфигурацию Nginx для домена
- ✅ Пересоберет клиент с правильным доменом
- ✅ Перезагрузит Nginx

### Шаг 5: Проверка работы

После деплоя проверьте:

1. **Откройте в браузере**: `http://oxxooy.online`
2. **Проверьте API**: `http://oxxooy.online/api/subjects`
3. **Проверьте www**: `http://www.oxxooy.online`

## Настройка SSL/HTTPS (Let's Encrypt)

После того как DNS записи настроены и сайт работает по HTTP, можно настроить HTTPS:

### Установка Certbot

```bash
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
```

### Получение SSL сертификата

```bash
sudo certbot --nginx -d oxxooy.online -d www.oxxooy.online
```

Certbot автоматически:
- ✅ Получит SSL сертификат от Let's Encrypt
- ✅ Настроит Nginx для HTTPS
- ✅ Настроит автоматическое обновление сертификата

### Автоматическое обновление сертификата

Certbot автоматически настроит cron задачу для обновления сертификата. Проверить можно:

```bash
sudo certbot renew --dry-run
```

## Итоговая конфигурация DNS

После настройки у вас должны быть следующие записи:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A | @ | 34.88.233.59 | Automatic |
| A | www | 34.88.233.59 | Automatic |

## Полезные команды для проверки

```bash
# Проверка DNS записей
nslookup oxxooy.online
dig oxxooy.online +short

# Проверка Nginx конфигурации
sudo nginx -t

# Просмотр логов Nginx
sudo tail -f /var/log/nginx/platonus_access.log
sudo tail -f /var/log/nginx/platonus_error.log

# Проверка статуса сервера
pm2 status
pm2 logs platonus-server
```

## Решение проблем

### Проблема: Домен не разрешается

1. Проверьте DNS записи в Namecheap
2. Подождите до 30 минут для распространения DNS
3. Очистите DNS кеш:
   ```bash
   # Windows
   ipconfig /flushdns
   
   # Linux/macOS
   sudo systemd-resolve --flush-caches
   ```

### Проблема: 502 Bad Gateway

1. Проверьте, что сервер запущен:
   ```bash
   pm2 status
   ```

2. Проверьте логи:
   ```bash
   pm2 logs platonus-server
   ```

3. Перезапустите сервер:
   ```bash
   pm2 restart platonus-server
   ```

### Проблема: Сайт не открывается

1. Проверьте firewall:
   ```bash
   sudo ufw status
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   ```

2. Проверьте, что Nginx запущен:
   ```bash
   sudo systemctl status nginx
   ```

## Контакты и поддержка

Если возникли проблемы:
- Проверьте логи Nginx: `/var/log/nginx/platonus_error.log`
- Проверьте логи сервера: `pm2 logs platonus-server`
- Убедитесь, что DNS записи настроены правильно в Namecheap

