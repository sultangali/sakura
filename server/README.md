# Platonus Test Server

## Установка и запуск

### 1. Установка MongoDB
```bash
# Ubuntu
sudo apt update
sudo apt install mongodb

# Или используйте MongoDB Atlas (облачная версия)
```

### 2. Настройка переменных окружения
Создайте файл `.env` в папке server:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/platonus
ADMIN_PASSWORD=ваш_пароль_админа
```

### 3. Установка зависимостей Node.js
```bash
cd server
npm install
```

**Примечание:** Библиотека `mathjax-node` для конвертации формул в изображения является опциональной. Если при установке возникают ошибки, сервер все равно будет работать, но формулы будут сохраняться как текст.

Для установки `mathjax-node` (опционально, для конвертации формул в изображения):
```bash
npm install mathjax-node --save-optional
```

Если установка `mathjax-node` не удалась из-за зависимостей, это не критично - сервер будет работать, просто формулы не будут конвертироваться в изображения.

### 4. Запуск сервера
```bash
# Development режим
npm run dev

# Production режим
npm start
```

## Развертывание на Google Cloud VM с Nginx и PM2

### 1. Установка Node.js и npm
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Установка PM2
```bash
sudo npm install -g pm2
```

### 3. Установка Nginx
```bash
sudo apt install nginx
```

### 4. Настройка Nginx
Создайте файл `/etc/nginx/sites-available/platonus`:
```nginx
server {
    listen 80;
    server_name your_domain_or_ip;

    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /uploads {
        proxy_pass http://localhost:5000/uploads;
    }
}
```

Активируйте конфигурацию:
```bash
sudo ln -s /etc/nginx/sites-available/platonus /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 5. Запуск сервера через PM2
```bash
cd /path/to/server
pm2 start index.js --name "platonus-api"
pm2 save
pm2 startup
```

## API Endpoints

### Авторизация админа
- `POST /api/admin/login` - { password: string }

### Предметы
- `GET /api/subjects` - Получить все предметы
- `POST /api/subjects` - Создать предмет { name: string }
- `DELETE /api/subjects/:id` - Удалить предмет

### Группы
- `GET /api/groups` - Получить все группы
- `POST /api/groups` - Создать группу { name: string }
- `DELETE /api/groups/:id` - Удалить группу

### Студенты
- `GET /api/students?groupId=` - Получить студентов группы
- `POST /api/students` - Создать студента { fullName: string, groupId: string }
- `DELETE /api/students/:id` - Удалить студента

### Вопросы
- `GET /api/questions?subjectId=` - Получить вопросы по предмету
- `POST /api/questions/upload` - Загрузить DOCX файл (form-data: file, subjectId)
- `POST /api/questions` - Ручное добавление вопроса
- `DELETE /api/questions/:id` - Удалить вопрос

## Формат DOCX файла с вопросами

```
<question>
Текст первого вопроса
<variant>Правильный ответ (первый всегда правильный)
<variant>Неправильный ответ 2
<variant>Неправильный ответ 3
<variant>Неправильный ответ 4
<variant>Неправильный ответ 5
<question>
Текст второго вопроса
<variant>Правильный ответ
...
```

Изображения в документе автоматически извлекаются и сохраняются на сервере.

## Обработка формул

Система автоматически определяет сложные математические формулы в вариантах ответов и конвертирует их в изображения (SVG) для корректного отображения. 

**Важно:** Для работы конвертации формул требуется установленная библиотека `mathjax-node`. Если она не установлена, формулы будут сохраняться как обычный текст.

Формулы определяются по наличию:
- Математических символов (∫, ∑, √, ∞, ±, и т.д.)
- Греческих букв (α, β, γ, и т.д.)
- Интегралов и дифференциальных операторов
- Сложных математических выражений

Если формула найдена и `mathjax-node` установлен, она автоматически конвертируется в SVG изображение с помощью MathJax и сохраняется в папке `/uploads/`. Если `mathjax-node` не установлен, формула сохраняется как обычный текст.

