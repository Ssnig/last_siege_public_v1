import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Plugin ensuring case-resilient asset loading (e.g. /assets/UI/ -> /assets/ui/)
function caseInsensitiveAssetsPlugin() {
  return {
    name: 'case-insensitive-assets',
    configureServer(server: any) {
      server.middlewares.use((req: any, _res: any, next: any) => {
        if (req.url && req.url.startsWith('/assets/UI/')) {
          req.url = req.url.replace(/^\/assets\/UI\//, '/assets/ui/');
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), caseInsensitiveAssetsPlugin()],
  resolve: {
    alias: {
      '@root/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
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
