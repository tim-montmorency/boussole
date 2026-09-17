import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.js',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:8080/app/',
    ...devices['Pixel 7'],
  },
  webServer: {
    command: 'node ../tools/serve.mjs 8080',
    url: 'http://localhost:8080/app/',
    reuseExistingServer: !process.env.CI,
  },
});
