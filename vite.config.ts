import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'pwa-192x192.svg', 'pwa-512x512.svg'],
        manifest: {
          name: 'AR-AuAgPt | Live Bullion Tracker',
          short_name: 'AR-AuAgPt',
          description: 'Live Gold, Silver & Platinum prices with Indian Import Duties and Gemini AI Analysis.',
          theme_color: '#0A0A0B',
          background_color: '#0A0A0B',
          display: 'standalone',
          icons: [
            {
              src: 'pwa-192x192.svg',
              sizes: '192x192',
              type: 'image/svg+xml'
            },
            {
              src: 'pwa-512x512.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ],
    define: {
      'import.meta.env.VITE_GOLD_API_KEY': JSON.stringify(env.VITE_GOLD_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': 'http://localhost:3001'
      }
    },
  };
});
