import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.mjs',
  outputDir: process.env.E2E_OUTPUT_DIR || '../../.playwright/results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1400, height: 1000 },
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
