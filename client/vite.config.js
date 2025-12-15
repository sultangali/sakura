import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Загружаем переменные окружения
  const env = loadEnv(mode, process.cwd(), '')
  
  // IP облачного сервера
  const SERVER_IP = env.VITE_SERVER_IP || '34.88.233.59'
  const LOCAL_PORT = env.VITE_LOCAL_PORT || '5000'
  
  // Определяем цель проксирования
  // В режиме FORCE_CLOUD проксируем на облачный сервер
  // Иначе на локальный
  const forceCloud = env.VITE_FORCE_CLOUD === 'true'
  const proxyTarget = forceCloud 
    ? `http://${SERVER_IP}` 
    : `http://localhost:${LOCAL_PORT}`
  
  console.log(`\n🔄 Vite Proxy Target: ${proxyTarget}\n`)
  
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      host: true, // Доступен из сети (0.0.0.0)
      
      // Проксирование API запросов
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
          // Для работы через университетский прокси
          configure: (proxy, options) => {
            proxy.on('error', (err, req, res) => {
              console.log('❌ Proxy error:', err.message)
            })
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log(`➡️  ${req.method} ${req.url} -> ${proxyTarget}${req.url}`)
            })
          }
        },
        '/uploads': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false
        }
      }
    },
    
    // Переменные окружения доступны через import.meta.env
    envPrefix: 'VITE_',
    
    // Build настройки для production
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: false // Оставляем console.log для отладки
        }
      }
    }
  }
})
