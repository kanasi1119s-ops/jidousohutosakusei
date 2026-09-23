import { defineConfig, type Plugin } from 'vitest/config'

// Vite はビルド出力の<script>/<link>にデフォルトで crossorigin 属性を付与するが、
// 一部のブラウザ環境ではこの属性付きリクエストがネットワーク切断時に
// Service Worker の fetch ハンドラへ届かず ERR_FAILED になる（オフライン動作の検証で発見）。
// 本サイトは同一オリジンの静的ファイルのみを配信するため、crossorigin は不要であり除去する。
function stripCrossorigin(): Plugin {
  return {
    name: 'strip-crossorigin',
    transformIndexHtml(html) {
      return html.replace(/\s+crossorigin(="[^"]*")?/g, '')
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [stripCrossorigin()],
  build: {
    target: 'es2020',
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
