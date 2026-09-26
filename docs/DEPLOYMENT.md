# Deployment

Panduan produksi untuk satu server (VM/droplet) dengan PostgreSQL 16, Node.js 20+, bun, nginx, dan Chromium. Arsitektur lengkap: [ARCHITECTURE.md §8](../ARCHITECTURE.md).

## 1. Prasyarat

| Komponen | Catatan |
|---|---|
| PostgreSQL 16 | Ekstensi `pgcrypto` dan `pg_trgm` (dibuat oleh migration; user DB perlu hak `CREATE EXTENSION` saat migrate pertama) |
| Node.js ≥ 20 + bun | bun untuk install & script; runtime API tetap Node (`tsx`) |
| Chromium | Untuk PDF MO (Puppeteer). Di server pakai Chromium sistem lalu set `PUPPETEER_EXECUTABLE_PATH` (mis. `/usr/bin/chromium`); paket Debian/Ubuntu: `chromium` + font `fonts-liberation`. Tanpa variabel ini, `bun install` mengunduh Chrome sendiri |
| DigitalOcean Spaces | Bucket **privat** terpisah untuk produksi (lihat README bagian Spaces) |
| HTTPS | Wajib: cookie refresh `Secure` + `SameSite=Strict` di produksi |

## 2. Konfigurasi

`apps/api/.env` (divalidasi saat startup; API menolak jalan bila tidak valid):

```
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://USER:PASS@HOST:5432/inc_mo
JWT_ACCESS_SECRET=<acak ≥ 32 karakter, mis. `openssl rand -base64 48`>
CORS_ORIGINS=https://mo.inilah.com
S3_ENDPOINT=https://sgp1.digitaloceanspaces.com
S3_REGION=sgp1
S3_BUCKET=inc-mo-prod
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
SEED_PASSWORD=<password awal superadmin>
```

`apps/web/.env` saat build: `VITE_API_BASE_URL=/api/v1` (API disajikan di origin yang sama lewat nginx, jadi cookie & CORS tidak perlu lintas situs).

## 3. Build & rilis

```bash
git pull && bun install --frozen-lockfile
cd apps/api
bun run prisma migrate deploy        # sebelum API start; aman diulang
bun run db:seed                      # sekali di awal: organisasi, master data, superadmin (akun demo TIDAK dibuat di production)
cd ../web && bun run build           # hasil di apps/web/dist
```

Jalankan API sebagai service (systemd/pm2), contoh systemd:

```ini
[Service]
WorkingDirectory=/srv/inc-oplah/apps/api
EnvironmentFile=/srv/inc-oplah/apps/api/.env
ExecStart=/usr/bin/env bun run start
Restart=always
```

Setelah login pertama sebagai `superadmin@inilah.local`, ganti password dan lengkapi master data (profil perusahaan, penandatangan + TTD/stempel, sales).

## 4. nginx

```nginx
server {
  server_name mo.inilah.com;
  root /srv/inc-oplah/apps/web/dist;
  client_max_body_size 12m;                 # lampiran MO maks 10 MB

  location /api/ { proxy_pass http://127.0.0.1:4000; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $remote_addr; proxy_set_header X-Forwarded-Proto $scheme; }
  location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }
  location / { try_files $uri /index.html; } # fallback SPA
  # listen 443 ssl + sertifikat (certbot)
}
```

API memakai `trust proxy 1`, jadi rate limit & audit IP membaca `X-Forwarded-For` dari nginx.

## 5. Operasional

- **Health check**: `GET /api/v1/health` (cek koneksi DB).
- **Job terjadwal** (`src/jobs.ts`) berjalan di dalam proses API tiap jam: notifikasi H-30 akhir periode dan pembersihan refresh token kedaluwarsa. Aman untuk banyak instance (dikunci `pg_try_advisory_xact_lock`).
- **Backup**: `pg_dump` harian + versioning bucket Spaces. File (TTD, stempel, PDF final, lampiran) hanya ada di Spaces.
- **Log**: JSON (pino) ke stdout; data sensitif (password, NIK, token, cookie) disensor.
- **Rilis ulang**: ulangi langkah 3 lalu restart service API. PDF MO yang sudah disubmit tersimpan di Spaces; Super Admin bisa "Generate ulang PDF" dari detail MO bila template berubah.

## 6. Verifikasi setelah rilis

```bash
curl -fsS https://mo.inilah.com/api/v1/health
E2E_BASE_URL=https://staging.mo.inilah.com bun run e2e   # hanya di staging: membuat data uji
```
