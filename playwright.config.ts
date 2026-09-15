import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 60_000,
  // Two projects over ~160 tests. The suite reached 14.5 of its 15 minutes
  // before this budget was raised, so the next test added to it — whichever it
  // was — silently left the tail of the alphabet unrun rather than failing.
  // Kept below the browser job's timeout-minutes so an overrun is still caught.
  globalTimeout: 1_500_000,
  maxFailures: 1,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] } : {},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1920, height: 1080 } } },
    { name: 'laptop', use: { viewport: { width: 1366, height: 768 } } },
  ],
  webServer: {
    command: 'npm run start:local',
    url: 'http://127.0.0.1:4173/health',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
