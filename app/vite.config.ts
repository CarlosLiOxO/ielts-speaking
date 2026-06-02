import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // 代理本地 Mimo API 服务，避免 API Key 暴露到浏览器
      '/api/mimo': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
})
