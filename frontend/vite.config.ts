import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En développement, /api/... est redirigé vers FastAPI : pas besoin de configurer CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
