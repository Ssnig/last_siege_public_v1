import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0', // Listen on all network interfaces (LAN/Wi-Fi)
    port: 5173,
    proxy: {
      '/colyseus': {
        target: 'http://127.0.0.1:2567',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/colyseus/, ''),
      },
      '/api': {
        target: 'http://127.0.0.1:2567',
        changeOrigin: true,
      },
    },

  },

})
