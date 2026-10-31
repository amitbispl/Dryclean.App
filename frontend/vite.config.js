import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://localhost:63891',
        changeOrigin: true,
        secure: false
      }
    },
    watch: {
      usePolling: true,
      interval: 1000,
    }
  }
})
