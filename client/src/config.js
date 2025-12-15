// Конфигурация API - автоматическое определение режима
// IP адрес облачного сервера: 34.88.233.59

// Переменные окружения (можно задать через .env файл)
const SERVER_IP = import.meta.env.VITE_SERVER_IP || '34.88.233.59';
const LOCAL_PORT = import.meta.env.VITE_LOCAL_PORT || '5000';

// Режим сервера: 'cloud' или 'local'
// VITE_SERVER_MODE=cloud - использовать облачный сервер
// VITE_SERVER_MODE=local - использовать локальный сервер
// Если не задан, автоматически определяется по hostname
const SERVER_MODE = import.meta.env.VITE_SERVER_MODE || 'auto';

// Определяем, использовать ли облачный сервер
let useCloudServer;
if (SERVER_MODE === 'cloud') {
  useCloudServer = true;
} else if (SERVER_MODE === 'local') {
  useCloudServer = false;
} else {
  // Автоматическое определение: если hostname = IP сервера - облако, иначе локальный
  const isLocalhost = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      window.location.hostname === '';
  useCloudServer = !isLocalhost && !import.meta.env.DEV;
}

// Определяем режим работы (development/production)
// В dev режиме (npm run dev) всегда используем development
// В production build используем production
const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

// Локальный режим (development) - запросы идут через Vite proxy
// Если useCloudServer=true, Vite проксирует на облачный сервер
// Если useCloudServer=false, Vite проксирует на localhost:5000
const LOCAL_API_URL = '/api'; // Всегда через Vite proxy в dev режиме
const LOCAL_SERVER_URL = useCloudServer ? `http://${SERVER_IP}` : `http://localhost:${LOCAL_PORT}`;

// Облачный режим - запросы идут напрямую на облачный сервер
// В production build используем относительные пути для работы через Nginx
const CLOUD_API_URL = import.meta.env.PROD ? '/api' : `http://${SERVER_IP}/api`;
const CLOUD_SERVER_URL = import.meta.env.PROD ? '' : `http://${SERVER_IP}`;

// Экспортируем конфигурацию в зависимости от режима
export const API_URL = isDevelopment ? LOCAL_API_URL : CLOUD_API_URL;
export const SERVER_URL = isDevelopment ? LOCAL_SERVER_URL : CLOUD_SERVER_URL;

// Флаг для определения режима
export const IS_DEVELOPMENT = isDevelopment;
export const IS_CLOUD = !isDevelopment;

// Для отладки
console.log('═══════════════════════════════════════');
console.log('📋 Client Configuration:');
console.log(`   SERVER_MODE: ${SERVER_MODE} (${useCloudServer ? 'cloud' : 'local'})`);
if (isDevelopment) {
  console.log('🔧 Режим: ЛОКАЛЬНЫЙ (Development)');
  console.log(`   Vite Proxy → ${useCloudServer ? SERVER_IP : `localhost:${LOCAL_PORT}`}`);
} else {
  console.log('☁️ Режим: ОБЛАЧНЫЙ (Production)');
  console.log(`   Сервер: ${SERVER_IP}`);
  console.log(`   Hostname: ${window.location.hostname}`);
}
console.log(`   API URL: ${API_URL}`);
console.log(`   Server URL: ${SERVER_URL}`);
console.log(`   Mode: ${import.meta.env.MODE}`);
console.log('═══════════════════════════════════════');
