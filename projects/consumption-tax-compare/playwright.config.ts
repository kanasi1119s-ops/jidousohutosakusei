import { defineConfig, devices } from '@playwright/test'
import fs from 'node:fs'

// 一部のサンドボックス環境ではPlaywrightのブラウザが固定パスに事前インストールされており、
// npm解決されたバージョンが期待するリビジョンと異なる場合がある。そのパスが存在するときだけ
// 明示的に使用し、存在しない環境（GitHub Actions等）では通常のインストール解決に任せる。
const sandboxChromium = '/opt/pw-browsers/chromium'
const launchOptions = fs.existsSync(sandboxChromium) ? { executablePath: sandboxChromium } : {}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'], launchOptions },
    },
  ],
})
