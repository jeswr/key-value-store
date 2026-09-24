import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/browser',
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: { headless: true, trace: 'retain-on-failure' },
});
