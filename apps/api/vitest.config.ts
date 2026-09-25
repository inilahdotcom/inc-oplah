import { defineConfig } from 'vitest/config';

try {
  process.loadEnvFile('.env');
} catch {
  // .env opsional di CI; variabel bisa datang dari environment.
}

export default defineConfig({
  test: {
    globalSetup: './src/test/global-setup.ts',
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? '',
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'test-secret-test-secret-test-secret-00',
    },
  },
});
