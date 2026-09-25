# Oplah — Inilah Client & Media Order Management

Monorepo (bun workspaces):

| Path | Isi |
|---|---|
| `apps/web` | React 18 + Vite + Tailwind v4 + shadcn/ui |
| `apps/api` | Node.js + Express 5 + Prisma 5 (PostgreSQL 16) |
| `packages/shared` | `@inc/shared`: enum, matriks izin, skema Zod, util format |

Dokumen acuan: [AGENT.md](AGENT.md) → [PRD](docs/design/PRD.md) → [DATABASE.md](DATABASE.md) → [ARCHITECTURE.md](ARCHITECTURE.md) → [DESIGN.md](DESIGN.md) / [docs/design/README.md](docs/design/README.md). Keputusan di luar dokumen: [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md).

## Menjalankan lokal

```bash
cp .env.example apps/api/.env           # hapus bagian "web" di bawahnya
echo "VITE_API_BASE_URL=http://localhost:4000/api/v1" > apps/web/.env
bun install
docker compose up -d                    # postgres
cd apps/api && bun run prisma migrate deploy && bun run db:seed && cd ../..
bun run dev                             # web :5173 + api :4000
```

Akun development (password `password123`): `superadmin@`, `sales@`, `finance@`, `viewer@inilah.local`.

## Setup DigitalOcean Spaces (upload tanda tangan, stempel, PDF, lampiran)

1. Control Panel → **Spaces Object Storage** → **Create Bucket**: pilih region (mis. SGP1), nama mis. `inc-mo-dev`, akses privat, CDN mati.
2. Tab **Access Keys** → **Create Access Key** → *Limited Access* ke bucket tersebut (Read/Write/Delete). Salin *Access Key ID* dan *Secret Key* (secret hanya tampil sekali).
3. Isi di `apps/api/.env`:
   ```
   S3_ENDPOINT=https://sgp1.digitaloceanspaces.com
   S3_REGION=sgp1
   S3_BUCKET=inc-mo-dev
   S3_ACCESS_KEY=...
   S3_SECRET_KEY=...
   ```
Tanpa kredensial, API tetap jalan; hanya endpoint upload yang membalas "Storage belum dikonfigurasi". Test otomatis tidak menyentuh Spaces.

## Cek kualitas

```bash
bun run lint && bun run typecheck && bun run test   # test API me-reset database inc_mo_test
```

## Status milestone

- [x] **M1 Fondasi**: monorepo, Docker, schema + migration (termasuk constraint & view `v_mo_finance`), seed, auth (login/refresh/logout/me), RBAC, halaman Login + app shell.
- [x] **M2 Master data & klien**: CRUD klien + pencarian + peringatan duplikat, master data (benefit, penandatangan + upload TTD/stempel, sales, opsi formulir, pajak & penomoran, profil perusahaan, pengguna).
- [ ] M3 MO & PDF · M4 Realisasi · M5 Finance · M6 Hardening
