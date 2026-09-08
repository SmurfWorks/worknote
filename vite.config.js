import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { VitePWA } from 'vite-plugin-pwa'

const portable = process.env.PORTABLE !== '0'

const pwa = VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.js',
  registerType: 'autoUpdate',
  includeAssets: ['icon.svg', 'favicon.svg', 'icon-192.png', 'icon-512.png'],
  manifest: {
    name: 'Worknote',
    short_name: 'Worknote',
    description: 'Record a quick voice note of what you worked on today.',
    theme_color: '#2a2d36',
    background_color: '#2a2d36',
    display: 'standalone',
    display_override: ['fullscreen', 'standalone'],
    orientation: 'portrait',
    start_url: './',
    scope: './',
    icons: [
      {
        src: 'icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: 'icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: 'icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: 'icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  },
})

export default defineConfig({
  base: './',
  build: {
    outDir: 'docs',
  },
  plugins: [vue(), tailwindcss(), portable ? viteSingleFile() : pwa],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
