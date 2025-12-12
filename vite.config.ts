import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // PWA Configuration for mobile "Add to Home Screen"
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'bimatic-logo.svg'],
      manifest: {
        name: 'CoffeeBIM Editor',
        short_name: 'CoffeeBIM',
        description: 'BIM Modellierung für Kaffeebars und Gastronomie',
        theme_color: '#BFA665',
        background_color: '#F7F4F3',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          // PNG icons should be added for better compatibility:
          // { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          // { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // Cache static assets
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],
        // Don't cache large 3D assets and WASM files
        globIgnores: ['**/*.{glb,gltf,obj,wasm}'],
        // Allow larger JS bundles (web-ifc and three.js are large)
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB
        runtimeCaching: [
          {
            // Cache 3D assets with network-first strategy
            urlPattern: /\.(?:glb|gltf|obj)$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: '3d-assets-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    allowedHosts: ['host.docker.internal'],
  },
  optimizeDeps: {
    exclude: ['web-ifc', 'opencascade.js'],
  },
  worker: {
    format: 'es',
  },
  assetsInclude: ['**/*.wasm'],
});
