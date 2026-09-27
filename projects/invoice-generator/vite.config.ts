import { defineConfig, type Plugin } from 'vitest/config'

// income-wall-simulatorで判明した既知の問題への対策: Viteが付与するcrossorigin属性は
// Service Workerのfetchハンドラでオフライン時にERR_FAILEDとなることがあるため、
// 同一オリジンのみを配信する本サイトでは除去する。
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
