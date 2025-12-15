# Инструкция по развертыванию Platonus Test System

## Быстрый старт

### Автоматическое развертывание

```bash
# Клонируйте репозиторий (если еще не сделали)
cd /path/to/platonus-buketov

# Запустите скрипт развертывания
sudo ./deploy.sh
```

Скрипт автоматически:
- ✅ Установит Node.js, PM2, Nginx
- ✅ Установит зависимости проекта
- ✅ Настроит переменные окружения
- ✅ Соберет клиент для production
- ✅ Запустит сервер через PM2
- ✅ Настроит Nginx как reverse proxy
- ✅ Настроит автозапуск всех сервисов

### Настройка домена (опционально)

Если у вас есть домен, задайте его перед запуском:

```bash
export DOMAIN=yourdomain.com
sudo ./deploy.sh
```

Или отредактируйте скрипт и измените переменную `DOMAIN`.

## Ручное развертывание

### 1. Установка зависимостей

```bash
# Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2
sudo npm install -g pm2

# Nginx
sudo apt-get update
sudo apt-get install -y nginx

# ImageMagick (опционально, для конвертации WMF)
sudo apt-get install -y imagemagick

# MongoDB
sudo apt-get install -y mongodb
# Или используйте MongoDB Atlas (облачная версия)
```

### 2. Настройка сервера

```bash
cd server

# Установка зависимостей
npm install

# Настройка .env
cp env.example .env
nano .env  # Отредактируйте настройки
```

Файл `.env`:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/platonus
ADMIN_PASSWORD=ваш_надежный_пароль
```

### 3. Настройка клиента

```bash
cd client

# Установка зависимостей
npm install

# Сборка для production
npm run build
```

### 4. Запуск сервера через PM2

```bash
cd server

# Запуск
pm2 start index.js --name platonus-server --env production

# Сохранение конфигурации
pm2 save

# Настройка автозапуска
pm2 startup systemd
# Выполните команду, которую выведет PM2
```

### 5. Настройка Nginx

Создайте файл `/etc/nginx/sites-available/platonus`:

```nginx
upstream platonus_api {
    server localhost:5000;
}

server {
    listen 80;
    server_name yourdomain.com;  # Или localhost

    client_max_body_size 50M;

    # Статические файлы клиента
    location / {
        root /path/to/platonus-buketov/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # API
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
    }

    # Загруженные файлы
    location /uploads {
        alias /path/to/platonus-buketov/server/uploads;
        expires 1y;
    }
}
```

Активируйте конфигурацию:

```bash
sudo ln -s /etc/nginx/sites-available/platonus /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Настройка MongoDB

```bash
# Запуск MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Проверка статуса
sudo systemctl status mongod
```

## Настройка HTTPS (Let's Encrypt)

```bash
# Установка Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d yourdomain.com

# Автоматическое обновление
sudo certbot renew --dry-run
```

## Полезные команды

### PM2

```bash
pm2 status                    # Статус процессов
pm2 logs platonus-server      # Логи сервера
pm2 restart platonus-server   # Перезапуск
pm2 stop platonus-server      # Остановка
pm2 delete platonus-server    # Удаление
```

### Nginx

```bash
sudo nginx -t                 # Проверка конфигурации
sudo systemctl reload nginx   # Перезагрузка
sudo systemctl restart nginx  # Перезапуск
sudo systemctl status nginx   # Статус
```

### MongoDB

```bash
sudo systemctl start mongod   # Запуск
sudo systemctl stop mongod    # Остановка
sudo systemctl status mongod  # Статус
mongo                         # Подключение к БД
```

### Логи

```bash
# Логи сервера
pm2 logs platonus-server

# Логи Nginx
sudo tail -f /var/log/nginx/platonus_access.log
sudo tail -f /var/log/nginx/platonus_error.log

# Логи системы
sudo journalctl -u nginx -f
```

## Обновление приложения

```bash
# 1. Остановите сервер
pm2 stop platonus-server

# 2. Обновите код (git pull или загрузите новые файлы)

# 3. Обновите зависимости
cd server && npm install
cd ../client && npm install && npm run build

# 4. Перезапустите сервер
pm2 restart platonus-server
```

## Устранение неполадок

### Сервер не запускается

```bash
# Проверьте логи
pm2 logs platonus-server --lines 50

# Проверьте .env файл
cat server/.env

# Проверьте MongoDB
sudo systemctl status mongod
```

### Nginx возвращает 502 Bad Gateway

```bash
# Проверьте, запущен ли сервер
pm2 status

# Проверьте порт
netstat -tuln | grep 5000

# Проверьте логи Nginx
sudo tail -f /var/log/nginx/platonus_error.log
```

### Файлы не загружаются

```bash
# Проверьте права доступа
sudo chown -R $USER:$USER server/uploads
sudo chmod -R 755 server/uploads

# Проверьте размер файла в Nginx конфигурации
# client_max_body_size должен быть достаточным
```

## Безопасность

1. **Измените пароль админа** в `server/.env`
2. **Настройте firewall**:
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```
3. **Используйте HTTPS** для production
4. **Регулярно обновляйте** систему и зависимости
5. **Настройте резервное копирование** MongoDB

## Резервное копирование

```bash
# Бэкап MongoDB
mongodump --out /backup/platonus-$(date +%Y%m%d)

# Восстановление
mongorestore /backup/platonus-20240101
```

## Поддержка

При возникновении проблем проверьте:
1. Логи PM2: `pm2 logs platonus-server`
2. Логи Nginx: `/var/log/nginx/platonus_*.log`
3. Статус сервисов: `systemctl status nginx mongod`
4. Порты: `netstat -tuln`

