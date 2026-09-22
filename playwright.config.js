import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 30_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Both suites render WebGL; parallel contexts compete for the same GPU.
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    // Full Chromium headless uses the host GPU for WebGL instead of headless-shell rasterization.
    channel: process.env.CINDER_BROWSER_CHANNEL || 'chromium',
    baseURL: 'http://127.0.0.1:4173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
  globalSetup: './tests/browser/setup.js',
});
