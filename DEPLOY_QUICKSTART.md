# Быстрый старт развертывания

## Файлы конфигурации

1. **`nginx-platonus.conf`** - Конфигурация Nginx для production
2. **`deploy.sh`** - Скрипт автоматического развертывания

## Развертывание на сервере

### Первое развертывание

```bash
# На сервере (34.88.233.59)
sudo ./deploy.sh
```

Скрипт автоматически:
- Установит все зависимости (Node.js, PM2, Nginx, MongoDB, ImageMagick, LibreOffice)
- Скопирует сервер в `/var/www/platonus/server`
- Соберет и скопирует клиент в `/var/www/platonus/client`
- Настроит PM2 для запуска сервера
- Настроит Nginx для проксирования запросов
- Создаст все необходимые `.env` файлы

### Повторное развертывание (обновление)

Если нужно обновить код после изменений:

```bash
# На сервере
cd /path/to/platonus-buketov
git pull  # или загрузите обновленный код
sudo ./deploy.sh
```

Скрипт автоматически:
- Обновит код в `/var/www/platonus`
- Пересоберет клиент
- Перезапустит сервер через PM2
- Перезагрузит Nginx

## Структура директорий после развертывания

```
/var/www/platonus/
├── client/          # Собранный React клиент (production build)
│   ├── index.html
│   ├── assets/
│   └── ...
└── server/          # Node.js сервер
    ├── index.js
    ├── package.json
    ├── node_modules/
    ├── uploads/     # Загруженные изображения
    └── .env         # Переменные окружения сервера
```

## Конфигурация Nginx

Конфигурация Nginx сохраняется в:
- `/etc/nginx/sites-available/platonus`
- Символическая ссылка: `/etc/nginx/sites-enabled/platonus`

Если нужно изменить конфигурацию:
1. Отредактируйте `nginx-platonus.conf` в проекте
2. Запустите `sudo ./deploy.sh` снова

Или отредактируйте напрямую:
```bash
sudo nano /etc/nginx/sites-available/platonus
sudo nginx -t  # Проверка конфигурации
sudo systemctl reload nginx  # Применение изменений
```

## Полезные команды

### PM2 (управление сервером)
```bash
pm2 status                    # Статус сервера
pm2 logs platonus-server      # Логи сервера
pm2 restart platonus-server   # Перезапуск
pm2 stop platonus-server      # Остановка
pm2 start platonus-server     # Запуск
```

### Nginx
```bash
sudo nginx -t                 # Проверка конфигурации
sudo systemctl status nginx   # Статус Nginx
sudo systemctl reload nginx   # Перезагрузка без простоя
sudo systemctl restart nginx  # Полный перезапуск
```

### Логи
```bash
# Логи Nginx
tail -f /var/log/nginx/platonus_access.log
tail -f /var/log/nginx/platonus_error.log

# Логи PM2
pm2 logs platonus-server
```

### MongoDB
```bash
sudo systemctl status mongod   # Статус MongoDB
sudo systemctl start mongod    # Запуск
sudo systemctl restart mongod  # Перезапуск
```

## Проверка работы

После развертывания проверьте:

1. **Сервер работает:**
   ```bash
   pm2 status
   # Должен показать "platonus-server" со статусом "online"
   ```

2. **Nginx работает:**
   ```bash
   sudo systemctl status nginx
   # Должен показать "active (running)"
   ```

3. **Сайт доступен:**
   - Откройте в браузере: `http://34.88.233.59`
   - API должен отвечать: `http://34.88.233.59/api/subjects`

4. **Проверка конфигурации Nginx:**
   ```bash
   sudo nginx -t
   # Должно показать "syntax is ok" и "test is successful"
   ```

## Решение проблем

### Сервер не запускается
```bash
# Проверьте логи
pm2 logs platonus-server --lines 50

# Проверьте .env файл
cat /var/www/platonus/server/.env

# Проверьте MongoDB
sudo systemctl status mongod
```

### Nginx возвращает 502 Bad Gateway
```bash
# Проверьте, что сервер запущен
pm2 status

# Проверьте порт
netstat -tlnp | grep 5000

# Проверьте логи Nginx
sudo tail -f /var/log/nginx/platonus_error.log
```

### Изображения не загружаются
```bash
# Проверьте права доступа
ls -la /var/www/platonus/server/uploads

# Установите права
sudo chmod -R 755 /var/www/platonus/server/uploads
sudo chown -R $USER:$USER /var/www/platonus/server/uploads
```

### Клиент не обновляется
```bash
# Убедитесь, что клиент пересобран
ls -la /var/www/platonus/client/

# Очистите кеш браузера (Ctrl+Shift+R)
```

## Переменные окружения

### Сервер (`.env` в `/var/www/platonus/server/`)
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/platonus
ADMIN_PASSWORD=your_password_here
```

### Клиент (`.env.production` в `client/`)
```env
VITE_SERVER_IP=34.88.233.59
VITE_LOCAL_PORT=5000
```

## Обновление IP адреса

Если нужно изменить IP адрес сервера:

1. Отредактируйте `deploy.sh`:
   ```bash
   DOMAIN="${DOMAIN:-новый_ip_адрес}"
   ```

2. Или задайте через переменную окружения:
   ```bash
   DOMAIN=новый_ip_адрес sudo ./deploy.sh
   ```

3. Обновите `nginx-platonus.conf`:
   ```bash
   server_name новый_ip_адрес _;
   ```

4. Запустите развертывание снова:
   ```bash
   sudo ./deploy.sh
   ```

