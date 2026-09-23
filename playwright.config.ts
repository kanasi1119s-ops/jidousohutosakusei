import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// サンドボックス環境ではプリインストール済みのChromiumを直接指定して使う
// (npm install されたバージョンとマイナーバージョンが食い違い、自動ダウンロードが必要になるのを避ける)
const preinstalledChromium = '/opt/pw-browsers/chromium'
const executablePath = existsSync(preinstalledChromium) ? preinstalledChromium : undefined

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: { executablePath } },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
        launchOptions: { executablePath },
      },
    },
  ],
})
