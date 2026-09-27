import { defineConfig, devices } from '@playwright/test'
import fs from 'node:fs'

const sandboxChromium = '/opt/pw-browsers/chromium'
const launchOptions = fs.existsSync(sandboxChromium) ? { executablePath: sandboxChromium } : {}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4174',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4174 --host 127.0.0.1',
    url: 'http://127.0.0.1:4174',
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
