import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// ダブルクリック(file://)でそのまま開けるローカル確認用の単一HTMLファイルを
// 生成するための別ビルド設定。実際の公開用ビルドは vite.config.ts(通常の
// `npm run build`)を使うこと。こちらはPWA/Service Workerを含まない。
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist-standalone',
    rollupOptions: {
      input: 'standalone.html',
    },
  },
  plugins: [viteSingleFile()],
})
