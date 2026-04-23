import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  webServer: {
    command: 'pnpm exec vite --host 127.0.0.1 --port 4173',
    port: 4173,
    reuseExistingServer: !process.env['CI'],
    timeout: 30_000
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    channel: 'msedge',
    headless: true
  }
})