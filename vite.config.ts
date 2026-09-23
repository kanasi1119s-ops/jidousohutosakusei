import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'ふるさと納税 控除上限額シミュレーター',
        short_name: 'ふるさと納税シム',
        description: '入力データは一切外部送信せず、ブラウザ内だけで完結するふるさと納税控除上限額の概算シミュレーター',
        lang: 'ja',
        start_url: './',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#c0392b',
        icons: [
          { src: 'icons/icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
