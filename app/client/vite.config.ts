import path from 'node:path'
import fs from 'node:fs'
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

// Dev plugin enabling one-click persistence of Map Editor changes to project files
function devMapPersistencePlugin() {
  return {
    name: 'dev-map-persistence',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.method === 'POST' && req.url === '/api/dev/save-map') {
          let body = '';
          req.on('data', (chunk: any) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const { mapId, mapCode, gridMatrix, mapData } = data;
              if (!mapId) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'mapId is required' }));
                return;
              }

              // 1. Update packages/shared/src/game/maps.ts if mapCode provided
              if (mapCode) {
                const mapsFilePath = path.resolve(__dirname, '../../packages/shared/src/game/maps.ts');
                if (fs.existsSync(mapsFilePath)) {
                  let fileContent = fs.readFileSync(mapsFilePath, 'utf-8');
                  const varName = `${mapId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_MAP`;
                  const regex = new RegExp(`export const ${varName}: MapDefinition = [\\s\\S]*?\\n\\};`, 'm');
                  if (regex.test(fileContent)) {
                    fileContent = fileContent.replace(regex, mapCode.trim());
                    fs.writeFileSync(mapsFilePath, fileContent, 'utf-8');
                  }
                }
              }

              // 2. Save JSON assets if map folder exists
              const folderPrefixes: Record<string, string> = {
                konbaung: 'map_1_konbaung',
                bagan: 'map_2_bagan',
                inle: 'map_3_inle',
                mandalay: 'map_4_mandalay',
                innwa: 'map_5_innwa',
                bago: 'map_6_bago',
                deserted: 'map_7_deserted',
                twister: 'map_8_twister',
                river: 'map_9_river',
              };
              const folderName = folderPrefixes[mapId];
              if (folderName) {
                const mapDir = path.resolve(__dirname, `public/assets/maps/${folderName}`);
                if (fs.existsSync(mapDir)) {
                  if (mapData) {
                    fs.writeFileSync(path.join(mapDir, 'map_data.json'), JSON.stringify(mapData, null, 2), 'utf-8');
                  }
                  if (gridMatrix) {
                    fs.writeFileSync(path.join(mapDir, 'grid_matrix.json'), JSON.stringify(gridMatrix, null, 2), 'utf-8');
                  }
                }
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                message: `Map '${mapId}' successfully saved to packages/shared/src/game/maps.ts and assets!`,
              }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/

// Dev plugin enabling one-click persistence of custom audio files to public/assets/sfx/towers/
function devSoundPersistencePlugin() {
  return {
    name: 'dev-sound-persistence',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const sfxDir = path.resolve(__dirname, 'public/assets/sfx/towers');

        if (req.method === 'GET' && req.url === '/api/dev/list-sounds') {
          try {
            if (!fs.existsSync(sfxDir)) {
              fs.mkdirSync(sfxDir, { recursive: true });
            }
            const allFiles = fs.readdirSync(sfxDir);
            const audioFiles = allFiles.filter((f) => /\.(mp3|wav|ogg|m4a)$/i.test(f));
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ files: audioFiles }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        if (req.method === 'POST' && req.url === '/api/dev/save-sound') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const { fileName, fileDataBase64 } = data;
              if (!fileName || !fileDataBase64) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'fileName and fileDataBase64 are required' }));
                return;
              }
              if (!fs.existsSync(sfxDir)) {
                fs.mkdirSync(sfxDir, { recursive: true });
              }
              const safeName = path.basename(fileName);
              const targetPath = path.join(sfxDir, safeName);
              const buffer = Buffer.from(fileDataBase64, 'base64');
              fs.writeFileSync(targetPath, buffer);

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, fileName: safeName, path: `/assets/sfx/towers/${safeName}` }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        if (req.method === 'POST' && req.url === '/api/dev/delete-sound') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const { fileName } = data;
              if (!fileName) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'fileName is required' }));
                return;
              }
              const safeName = path.basename(fileName);
              const targetPath = path.join(sfxDir, safeName);
              if (fs.existsSync(targetPath)) {
                fs.unlinkSync(targetPath);
              }
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, deleted: safeName }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), caseInsensitiveAssetsPlugin(), devMapPersistencePlugin(), devSoundPersistencePlugin()],
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
