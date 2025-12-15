// Конфигурация API - автоматическое определение режима
// IP адрес облачного сервера: 34.88.233.59

// Определяем режим работы
const isDevelopment = import.meta.env.DEV || 
                      import.meta.env.MODE === 'development' ||
                      window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1';

// Переменные окружения (можно задать через .env файл)
const SERVER_IP = import.meta.env.VITE_SERVER_IP || '34.88.233.59';
const LOCAL_PORT = import.meta.env.VITE_LOCAL_PORT || '5000';

// Локальный режим (development)
const LOCAL_API_URL = `http://localhost:${LOCAL_PORT}/api`;
const LOCAL_SERVER_URL = `http://localhost:${LOCAL_PORT}`;

// Облачный режим (production)
const CLOUD_API_URL = `http://${SERVER_IP}/api`;
const CLOUD_SERVER_URL = `http://${SERVER_IP}`;

// Экспортируем конфигурацию в зависимости от режима
export const API_URL = isDevelopment ? LOCAL_API_URL : CLOUD_API_URL;
export const SERVER_URL = isDevelopment ? LOCAL_SERVER_URL : CLOUD_SERVER_URL;

// Для отладки
if (isDevelopment) {
  console.log('🔧 Режим: ЛОКАЛЬНЫЙ (Development)');
  console.log(`API: ${API_URL}`);
  console.log(`Server: ${SERVER_URL}`);
} else {
  console.log('☁️ Режим: ОБЛАЧНЫЙ (Production)');
  console.log(`API: ${API_URL}`);
  console.log(`Server: ${SERVER_URL}`);
}

