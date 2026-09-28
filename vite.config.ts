import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Sur GitHub Pages, l'app est servie sous /<nom-du-dépôt>/ : BASE_PATH est fourni par la CI.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Data Spain · Barcelona',
        short_name: 'Data Spain',
        description: 'Precios y compraventas de vivienda por barrio en Barcelona (datos agregados oficiales).',
        lang: 'es',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0b0f16',
        theme_color: '#0b0f16',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Données agrégées de Barcelone en cache : consultation possible hors ligne.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}', 'data/sources.json', 'data/barcelona/*'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            // Fond de carte : tuiles, styles et polices réutilisés hors ligne quand ils ont déjà été vus.
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'fondo-mapa',
              expiration: { maxEntries: 1500, maxAgeSeconds: 30 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  worker: { format: 'es' },
});
