import { defineConfig } from '@playwright/test';

// E2E alur utama (PRD §13 M6). Butuh DB dev yang sudah di-seed (`bun --filter api prisma migrate deploy` + `db:seed`).
// Server dev dipakai ulang bila sudah jalan; set E2E_BASE_URL untuk menguji instance lain.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  reporter: [['list']],
  use: { baseURL, viewport: { width: 1400, height: 1000 }, trace: 'retain-on-failure' },
  webServer: process.env.E2E_BASE_URL ? undefined : { command: 'bun run dev', url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});
