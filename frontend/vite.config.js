import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.VITE_API_URL || 'http://localhost:5000/api'
  const socketUrl = env.VITE_SOCKET_URL || 'http://localhost:5000'

  // Extract base URL from API URL for proxy target
  const backendBase = apiUrl.replace('/api', '')

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: '0.0.0.0',
      // Allow all hosts (ngrok, localhost, LAN IP)
      allowedHosts: 'all',
      proxy: {
        // Only proxy in development (when backend is localhost)
        ...(mode === 'development' && {
          '/api': {
            target: backendBase,
            changeOrigin: true,
            secure: false,
          },
          '/socket.io': {
            target: backendBase,
            ws: true,
            changeOrigin: true,
            secure: false,
          }
        })
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      // Chunk splitting for better caching
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            charts: ['chart.js', 'react-chartjs-2'],
            socket: ['socket.io-client'],
          }
        }
      }
    },
    preview: {
      port: 4173,
      host: '0.0.0.0'
    }
  }
})