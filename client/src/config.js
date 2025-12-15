// Конфигурация API - автоматическое определение режима
// IP адрес облачного сервера: 34.88.233.59
// Университетский прокси: 192.168.1.101:3128 (настраивается на уровне ОС/браузера)

// Переменные окружения (можно задать через .env файл)
const SERVER_IP = import.meta.env.VITE_SERVER_IP || '34.88.233.59';
const LOCAL_PORT = import.meta.env.VITE_LOCAL_PORT || '5000';

// Принудительный режим (можно задать через .env)
// VITE_FORCE_CLOUD=true - всегда использовать облачный сервер
// VITE_FORCE_LOCAL=true - всегда использовать локальный сервер
const forceCloud = import.meta.env.VITE_FORCE_CLOUD === 'true';
const forceLocal = import.meta.env.VITE_FORCE_LOCAL === 'true';

// Определяем режим работы
const isLocalhost = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1';

// Если открыт с localhost И не принудительно облако - считаем development
// Если открыт с IP сервера ИЛИ принудительно облако - считаем production
let isDevelopment;
if (forceCloud) {
  isDevelopment = false;
} else if (forceLocal) {
  isDevelopment = true;
} else {
  isDevelopment = isLocalhost && import.meta.env.DEV;
}

// Локальный режим (development) - запросы идут на localhost
const LOCAL_API_URL = `/api`;  // Через Vite proxy
const LOCAL_SERVER_URL = `http://localhost:${LOCAL_PORT}`;

// Облачный режим - запросы идут напрямую на облачный сервер
// Университетский прокси автоматически обработает эти запросы
const CLOUD_API_URL = `http://${SERVER_IP}/api`;
const CLOUD_SERVER_URL = `http://${SERVER_IP}`;

// Экспортируем конфигурацию в зависимости от режима
export const API_URL = isDevelopment ? LOCAL_API_URL : CLOUD_API_URL;
export const SERVER_URL = isDevelopment ? LOCAL_SERVER_URL : CLOUD_SERVER_URL;

// Флаг для определения режима
export const IS_DEVELOPMENT = isDevelopment;
export const IS_CLOUD = !isDevelopment;

// Для отладки
console.log('═══════════════════════════════════════');
if (isDevelopment) {
  console.log('🔧 Режим: ЛОКАЛЬНЫЙ (Development)');
  console.log(`   Сервер: localhost:${LOCAL_PORT}`);
} else {
  console.log('☁️ Режим: ОБЛАЧНЫЙ (Production)');
  console.log(`   Сервер: ${SERVER_IP}`);
}
console.log(`   API URL: ${API_URL}`);
console.log(`   Server URL: ${SERVER_URL}`);
console.log('═══════════════════════════════════════');
