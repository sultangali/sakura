# Настройка для работы через университетский прокси

## Информация о прокси

- **Адрес прокси**: `192.168.1.101:3128`
- **Тип**: HTTP прокси
- **Облачный сервер**: `34.88.233.59`

## Режимы работы

### 1. Production (облачный сервер)

Когда клиент и сервер развернуты на `34.88.233.59`:

```
Браузер → Университетский прокси (192.168.1.101:3128) → Облачный сервер (34.88.233.59)
```

**Nginx на сервере** обрабатывает все запросы:
- `/` → Статические файлы клиента (`/var/www/platonus/client`)
- `/api` → Node.js сервер (`localhost:5000`)
- `/uploads` → Загруженные файлы (`/var/www/platonus/server/uploads`)

### 2. Development (локальный клиент + облачный сервер)

Когда клиент запускается локально через `npm run dev`, а сервер на облаке:

```
Браузер (localhost:5173) → Vite Dev Server → HTTP Proxy → Облачный сервер (34.88.233.59)
```

**Настройка:**

1. Скопируйте `.env.cloud` в `.env.local`:
   ```bash
   cd client
   cp .env.cloud .env.local
   ```

2. Запустите клиент:
   ```bash
   npm run dev
   ```

3. Откройте `http://localhost:5173`

### 3. Development (полностью локальный)

Когда и клиент, и сервер запущены локально:

```
Браузер (localhost:5173) → Vite Dev Server → Локальный сервер (localhost:5000)
```

**Настройка:**

1. Запустите сервер:
   ```bash
   cd server
   npm run dev
   ```

2. Запустите клиент (в другом терминале):
   ```bash
   cd client
   npm run dev
   ```

3. Откройте `http://localhost:5173`

## Настройка университетского прокси на ОС

### Windows

1. **Системный прокси:**
   - Параметры → Сеть и Интернет → Прокси-сервер
   - Включить "Использовать прокси-сервер"
   - Адрес: `192.168.1.101`
   - Порт: `3128`

2. **Переменные окружения** (для npm/node):
   ```cmd
   set HTTP_PROXY=http://192.168.1.101:3128
   set HTTPS_PROXY=http://192.168.1.101:3128
   ```

   Или в PowerShell:
   ```powershell
   $env:HTTP_PROXY = "http://192.168.1.101:3128"
   $env:HTTPS_PROXY = "http://192.168.1.101:3128"
   ```

### Linux

```bash
export HTTP_PROXY=http://192.168.1.101:3128
export HTTPS_PROXY=http://192.168.1.101:3128
export http_proxy=http://192.168.1.101:3128
export https_proxy=http://192.168.1.101:3128
```

Добавьте в `~/.bashrc` для постоянного использования.

### Для npm

```bash
npm config set proxy http://192.168.1.101:3128
npm config set https-proxy http://192.168.1.101:3128
```

## Переключение между режимами

### Использовать облачный сервер

```bash
cd client
echo "VITE_FORCE_CLOUD=true" > .env.local
npm run dev
```

### Использовать локальный сервер

```bash
cd client
echo "VITE_FORCE_LOCAL=true" > .env.local
npm run dev
```

## Проверка работы

### Проверка доступа к серверу через прокси

```bash
# Windows (PowerShell)
Invoke-WebRequest -Uri "http://34.88.233.59/api/subjects" -Proxy "http://192.168.1.101:3128"

# Linux
curl -x http://192.168.1.101:3128 http://34.88.233.59/api/subjects
```

### Проверка в браузере

1. Откройте `http://34.88.233.59` (через университетский прокси)
2. Откройте DevTools (F12) → Network
3. Проверьте, что API запросы возвращают 200 OK

## Troubleshooting

### Ошибка CORS

Если видите ошибки CORS:
1. Проверьте, что Nginx настроен правильно (файл `nginx-platonus.conf`)
2. Перезапустите Nginx: `sudo systemctl reload nginx`

### Timeout при запросах

Если запросы висят:
1. Проверьте, что прокси настроен в системе/браузере
2. Проверьте, что облачный сервер доступен

### Клиент не видит API

1. Проверьте консоль браузера (F12)
2. Убедитесь, что режим определен правильно (ЛОКАЛЬНЫЙ/ОБЛАЧНЫЙ)
3. Проверьте `.env.local` файл

## Быстрые команды

```bash
# Запуск с облачным сервером
VITE_FORCE_CLOUD=true npm run dev

# Запуск с локальным сервером
VITE_FORCE_LOCAL=true npm run dev

# Сборка для production
npm run build
```

