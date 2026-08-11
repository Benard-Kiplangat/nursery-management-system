import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5003,
    allowedHosts: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Nursery Management System',
        short_name: 'NurseryMS',
        description: 'Management system for a plant nursery',
        theme_color: '#4CAF50',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: './android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: './android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: './android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      }
    })
  ],
});