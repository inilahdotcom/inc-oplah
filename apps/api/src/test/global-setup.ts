import { execSync } from 'node:child_process';

/** Reset schema test lalu jalankan seed (akun dev untuk tiap role). */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL belum di-set (lihat .env.example)');
  execSync('bunx prisma migrate reset --force', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url, NODE_ENV: 'development' },
  });
}
