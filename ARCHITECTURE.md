# ARCHITECTURE.md

Arsitektur teknis Sistem Manajemen Klien & Media Order (MO) Inilah.com.
Detail skema database ada di `DATABASE.md`, sedangkan tampilan UI ada di `DESIGN.md`.

## 1. Gambaran Umum

```mermaid
flowchart LR
    U[Browser<br/>Admin Sales / Finance / Super Admin] -->|HTTPS| W[apps/web<br/>React + Vite + shadcn]
    W -->|REST JSON /api/v1| A[apps/api<br/>Node.js + Express]
    A -->|Prisma| DB[(PostgreSQL 16)]
    A -->|S3 API| S[(Object Storage<br/>DigitalOcean Spaces)]
    A --> P[PDF Renderer<br/>Puppeteer]
    A --> J[Job Scheduler<br/>node-cron]
    J --> DB
```

- **Monolith modular.** Ada satu service API, dengan kode dipisah per domain. Pemisahan menjadi microservice tidak dibutuhkan pada skala ini.
- **Stateless API.** Sesi disimpan di JWT dan refresh token di database, sehingga API bisa diskalakan horizontal.
- **PDF dirender di server** agar hasil cetak identik di semua perangkat. Hasil PDF final disimpan ke object storage saat MO disubmit.

## 2. Tech Stack

| Lapisan | Teknologi |
|---|---|
| Monorepo | bun workspaces (runtime API tetap Node.js via `tsx`) |
| Frontend | React 18, Vite, TypeScript, shadcn/ui, Tailwind CSS, React Router v6, TanStack Query v5, TanStack Table v8, React Hook Form, Zod, sonner, date-fns (locale `id`), lucide-react |
| Backend | Node.js 20 LTS, TypeScript, Express 5, Prisma 5, Zod, decimal.js, jsonwebtoken, bcrypt, multer, pino (logger), helmet, express-rate-limit, node-cron |
| PDF | Puppeteer + Handlebars |
| Excel | ExcelJS |
| Storage | `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` → DigitalOcean Spaces (bucket terpisah untuk dev & produksi) |
| Database | PostgreSQL 16 (ekstensi `pgcrypto`, `pg_trgm`) |
| Testing | Vitest, Supertest, Playwright |
| Infra | Docker, docker-compose |

## 3. Struktur Repository

```
/
├── apps/
│   ├── web/                     # React (sudah ada)
│   └── api/                     # Node.js
├── packages/
│   └── shared/                  # dipakai web & api
├── docs/
│   ├── PRD.md
│   └── ASSUMPTIONS.md
├── AGENT.md
├── ARCHITECTURE.md
├── DATABASE.md
├── DESIGN.md
├── docker-compose.yml
└── .env.example
```

### 3.1 `packages/shared` (`@inc/shared`)

Package ini adalah sumber tunggal kontrak antara frontend dan backend.

```
packages/shared/src/
├── schemas/            # Zod: client, media-order, publication, billing, auth, filters
├── enums.ts            # Role, MoStatus, BillingStatus, PaymentMethod, BenefitCode, ...
├── types.ts            # tipe response API (DTO)
├── format.ts           # formatRupiah, formatTanggal, formatPeriode ("Juni 2026 - Mei 2027")
├── permissions.ts      # matriks role → aksi (dipakai UI untuk show/hide)
└── index.ts
```

Contoh ekspor:

```ts
export const moStatus = ['DRAFT', 'SUBMITTED', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const;
export const billingStatus = ['NOT_READY', 'READY_TO_BILL', 'BILLED', 'PAID'] as const;
export const monetaryString = z.string().regex(/^\d+(\.\d{1,2})?$/);
export const createMediaOrderSchema = z.object({ /* ... */ });
export type CreateMediaOrderInput = z.infer<typeof createMediaOrderSchema>;
```

### 3.2 `apps/web`

Susunan folder berbasis fitur. Folder `components/ui` milik shadcn dan tidak diedit.

```
apps/web/src/
├── app/
│   ├── router.tsx               # definisi route + guard role
│   ├── providers.tsx            # QueryClient, Theme, Toaster
│   └── layouts/
│       ├── AppLayout.tsx        # sidebar + topbar + notifikasi
│       └── AuthLayout.tsx
├── components/
│   ├── ui/                      # shadcn (generated)
│   ├── data-table/              # wrapper TanStack Table
│   ├── currency-input.tsx
│   ├── month-range-picker.tsx
│   ├── status-badge.tsx
│   └── role-gate.tsx
├── features/
│   ├── auth/
│   ├── clients/
│   ├── media-orders/
│   │   ├── api.ts               # hooks TanStack Query
│   │   ├── components/          # MoForm, BenefitFieldArray, TaxSummary, ...
│   │   └── pages/               # MoListPage, MoCreatePage, MoDetailPage
│   ├── publications/
│   ├── finance/
│   ├── master-data/
│   └── notifications/
├── lib/
│   ├── api-client.ts            # fetch wrapper: base URL, token, refresh, AppError
│   ├── auth-store.ts
│   └── query-keys.ts
└── main.tsx
```

### Route frontend

| Path | Halaman | Role |
|---|---|---|
| `/login`, `/lupa-password`, `/reset-password` | Autentikasi | publik |
| `/` | Dashboard (isi berbeda per role) | semua |
| `/klien`, `/klien/:id` | Daftar & detail klien | SA, AS (FIN/VIEWER read-only) |
| `/mo` | Daftar MO | semua |
| `/mo/baru` | Form MO baru | SA, AS |
| `/mo/:id` | Detail MO (tab: Ringkasan, Realisasi, Lampiran, Tagihan, Riwayat) | semua |
| `/mo/:id/edit` | Edit Draft | SA, AS |
| `/finance` | Daftar MO versi Finance (kolom benefit, filter periode, ekspor) | SA, AS, FIN, VIEWER |
| `/pengaturan/:tab` | Tab: `benefit`, `penandatangan`, `sales`, `opsi-formulir`, `pajak` (pajak, penomoran, template T&C), `perusahaan`, `pengguna` | SA |

Guard route memakai `permissions.ts` dari shared package. Jika user membuka halaman tanpa izin, tampilkan halaman 403, bukan redirect diam-diam.

### 3.3 `apps/api`

```
apps/api/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── templates/
│   └── media-order.hbs          # template HTML PDF MO
│   └── media-order.css
└── src/
    ├── server.ts                # bootstrap
    ├── app.ts                   # express app, middleware global
    ├── config/env.ts            # validasi env dengan Zod
    ├── lib/
    │   ├── prisma.ts
    │   ├── logger.ts
    │   ├── storage.ts           # upload, signed URL
    │   ├── pdf.ts               # instance Puppeteer (reuse browser)
    │   └── app-error.ts
    ├── middleware/
    │   ├── authenticate.ts      # verifikasi JWT → req.user
    │   ├── require-role.ts
    │   ├── validate.ts          # Zod body/query/params
    │   ├── error-handler.ts
    │   └── audit-context.ts
    ├── modules/
    │   ├── auth/
    │   ├── users/
    │   ├── master-data/         # sales, signatories, benefit-types, form-options, settings
    │   ├── clients/
    │   ├── tax/                 # tax.service.ts (sumber tunggal rumus)
    │   ├── numbering/           # mo-number.service.ts
    │   ├── media-orders/
    │   │   ├── media-orders.routes.ts
    │   │   ├── media-orders.controller.ts
    │   │   ├── media-orders.service.ts
    │   │   ├── mo-status.machine.ts
    │   │   └── mo-pdf.service.ts
    │   ├── publications/
    │   │   └── fulfillment.service.ts
    │   ├── billings/
    │   ├── finance/             # list, export, dashboard
    │   ├── attachments/
    │   ├── notifications/
    │   └── audit/
    └── jobs/
        └── period-ending-reminder.job.ts
```

Setiap modul berisi `*.routes.ts`, `*.controller.ts`, `*.service.ts`, dan `*.test.ts`. Controller hanya mengurus parsing request dan response. Semua logika bisnis berada di service.

## 4. Pola Backend

### 4.1 Pipeline request

```
request → helmet/cors → rate-limit → authenticate → requireRole → validate(zod)
        → controller → service → prisma ($transaction bila perlu) → audit log
        → response | error-handler
```

### 4.2 Autentikasi

- **Access token**: JWT HS256, berlaku 15 menit, dikirim di header `Authorization: Bearer`. Payload berisi `{ sub, orgId, role, salesId }`.
- **Refresh token**: string acak, berlaku 7 hari, disimpan dalam bentuk hash di tabel `refresh_tokens`, dikirim lewat cookie `httpOnly; Secure; SameSite=Strict`. Token dirotasi setiap kali dipakai.
- `GET /auth/me` mengembalikan profil user aktif (dipakai web setelah login/refresh).
- **Di frontend**, `api-client.ts` menangani respons 401 dengan mencoba refresh sekali, lalu mengulang request. Jika refresh gagal, user diarahkan ke `/login`.

### 4.3 State machine MO

Semua transisi status dilakukan lewat `mo-status.machine.ts`. Service lain tidak boleh meng-update kolom `status` secara langsung.

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> SUBMITTED: submit
    DRAFT --> [*]: delete
    SUBMITTED --> ACTIVE: realisasi pertama / upload MO bertanda tangan
    SUBMITTED --> CANCELLED: cancel / revise
    ACTIVE --> COMPLETED: benefit 100%
    COMPLETED --> ACTIVE: realisasi dihapus (billing belum BILLED)
    ACTIVE --> CANCELLED: cancel / revise
```

`billing_status` dihitung ulang oleh `fulfillment.service.ts` setiap kali ada perubahan pada data publikasi:
- Jika status billing `NOT_READY` dan benefit sudah 100%, status berubah menjadi `READY_TO_BILL` dan notifikasi dikirim ke seluruh user Finance.
- Jika status billing `READY_TO_BILL` dan benefit turun di bawah 100%, status kembali menjadi `NOT_READY`.
- Jika status billing sudah `BILLED` atau `PAID`, sistem tidak mengubahnya secara otomatis.

### 4.4 Submit MO (transaksi)

```
BEGIN
  1. Lock baris media_orders (FOR UPDATE); pastikan status = DRAFT
  2. Validasi penuh dengan submitMediaOrderSchema
  3. Hitung ulang pajak dengan tax.service → tulis snapshot
  4. Snapshot klien & penandatangan
  5. mo-number.service.next(orgId, moDate)  -- lock mo_sequences
  6. UPDATE status=SUBMITTED, mo_number, submitted_at, submitted_by
  7. Tulis audit log
COMMIT
8. (di luar transaksi) Render PDF → upload → UPDATE pdf_key
   Jika gagal: MO tetap SUBMITTED, pdf_key NULL; endpoint /pdf akan merender ulang saat diminta.
```

### 4.5 Pembuatan PDF

- `lib/pdf.ts` menyimpan satu instance browser Chromium untuk dipakai ulang, dengan batas maksimal 3 halaman render bersamaan.
- Template `templates/media-order.hbs` berupa HTML statis dengan CSS print berukuran A4 dan satuan `mm`. Aset seperti logo, tanda tangan, dan stempel diambil dari storage lalu disisipkan sebagai data URI.
- Helper Handlebars: `rupiah`, `tanggal`, `periode`, `checked (code, selectedCodes)`.
- Nama file dan aturan watermark DRAFT mengikuti PRD §8.

### 4.6 Penyimpanan file

| Prefix key | Isi |
|---|---|
| `org/{orgId}/mo/{moId}/pdf/{moNumber}.pdf` | PDF MO final |
| `org/{orgId}/mo/{moId}/attachments/{uuid}.{ext}` | MO bertanda tangan klien |
| `org/{orgId}/publications/{pubId}/{uuid}.{ext}` | Screenshot realisasi |
| `org/{orgId}/signatories/{id}/signature.png`, `stamp.png` | Aset tanda tangan |

- Bucket bersifat privat. Klien mengakses file lewat signed URL yang berlaku 5 menit, dikeluarkan oleh endpoint yang sudah melewati pengecekan RBAC.
- Validasi upload memeriksa MIME dari *magic bytes*, bukan hanya ekstensi. Batas ukuran 10 MB untuk lampiran dan 5 MB untuk screenshot.

### 4.7 Ekspor Finance

- Endpoint ekspor memakai skema filter yang sama dengan endpoint daftar (`financeFilterSchema`).
- ExcelJS menulis workbook dalam mode streaming. Kolom nominal bertipe numerik dengan format `#,##0`, dan kolom tanggal bertipe tanggal.
- Kolom benefit dibentuk dinamis dari tabel `benefit_types` yang aktif.

### 4.8 Job terjadwal

| Job | Jadwal (WIB) | Fungsi |
|---|---|---|
| `period-ending-reminder` | Setiap hari 08:00 | Mencari MO `ACTIVE` dengan `period_end` dalam 30 hari ke depan dan pemenuhan < 100%, lalu mengirim notifikasi ke sales pembuat. Setiap MO hanya dinotifikasi satu kali. |
| `cleanup-refresh-tokens` | Setiap hari 02:00 | Menghapus token yang sudah kedaluwarsa. |

Jika API dijalankan lebih dari satu instance, job harus memakai `pg_try_advisory_lock` agar tidak berjalan ganda.

## 5. Pola Frontend

- **Server state** dikelola TanStack Query. Query key terpusat di `lib/query-keys.ts`, misalnya `['media-orders', 'list', filters]` dan `['media-orders', 'detail', id]`. Setelah mutasi, invalidasi key yang relevan.
- **Client state** cukup memakai React state. Auth disimpan dengan context kecil (`auth-store.ts`). Tidak perlu Redux.
- **Form MO** menggunakan satu instance `useForm` dengan beberapa `Card` per section, mengikuti urutan dokumen MO. Daftar benefit memakai `useFieldArray`. Ringkasan pajak diambil dari `POST /media-orders/calculate` dengan debounce 300 ms, sehingga frontend tidak menghitung sendiri.
- **Filter tabel** disinkronkan ke URL search params agar link bisa dibagikan dan filter tetap ada setelah refresh.
- **Unduh file** dilakukan dengan meminta signed URL ke API, lalu membukanya lewat `window.location` atau `<a download>`.
- **Role gate**: komponen `<RoleGate allow={['FINANCE']}>` untuk bagian UI, dan `permissions.ts` untuk guard route.

## 6. Keamanan

- `helmet`, CORS dengan whitelist origin dari env, `express-rate-limit` (login: 5 request/menit/IP, API umum: 300 request/menit/user).
- Password di-hash dengan bcrypt cost 12. Kebijakan password minimal 8 karakter.
- Setiap query tenant difilter dengan `organizationId` dari token. Ekstensi Prisma (`$extends`) menambahkan filter ini otomatis untuk model tenant sebagai lapis pengaman kedua.
- Logger (pino) menyensor `password`, `nik`, `authorization`, `cookie`, dan `token`.
- Header `Content-Disposition` pada unduhan dibentuk dari nama file yang sudah disanitasi.

## 7. Konfigurasi (`.env.example`)

```bash
# api
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://inc:inc@localhost:5432/inc_mo
JWT_ACCESS_SECRET=change-me-min-32-chars
CORS_ORIGINS=http://localhost:5173
S3_ENDPOINT=https://sgp1.digitaloceanspaces.com   # opsional; kosong = upload membalas 503
S3_REGION=sgp1
S3_BUCKET=inc-mo-dev
S3_ACCESS_KEY=
S3_SECRET_KEY=
APP_TIMEZONE=Asia/Jakarta
PUPPETEER_EXECUTABLE_PATH=
SMTP_URL=                       # untuk reset password

# web
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

`config/env.ts` memvalidasi seluruh variabel dengan Zod saat startup, sehingga aplikasi langsung gagal jalan bila konfigurasi tidak valid.

## 8. Lingkungan & Deployment

- **Lokal**: `docker-compose.yml` menjalankan `postgres:16`. File disimpan di bucket DigitalOcean Spaces khusus development (tanpa MinIO). Web dan API berjalan di host lewat `bun run dev`.
- **Produksi**: dua image Docker:
  - `api`: Node 20 slim + Chromium untuk Puppeteer.
  - `web`: hasil build Vite yang disajikan oleh nginx, dengan fallback SPA ke `index.html`.
- Migration dijalankan dengan `prisma migrate deploy` sebelum API start.
- Health check `GET /api/v1/health` memeriksa koneksi DB dan storage.

## 9. Strategi Testing

| Level | Alat | Cakupan wajib |
|---|---|---|
| Unit | Vitest | `tax.service`, `mo-number.service` (format, reset tahunan, bulan romawi), `mo-status.machine`, `fulfillment.service`, util format di shared |
| API | Vitest + Supertest + DB test (database `inc_mo_test`, di-reset per run) | Setiap endpoint: sukses, 400 validasi, 401, 403, 404/409 |
| Konkurensi | Vitest | 20 submit paralel menghasilkan 20 nomor unik dan berurutan |
| E2E | Playwright | Alur: login AS → buat klien → buat MO → submit → unduh PDF → input 12 realisasi → login FIN → MO muncul `READY_TO_BILL` → tandai BILLED → PAID |
| Visual PDF | Snapshot PNG halaman 1 (pdf-to-img) | Mendeteksi perubahan tata letak yang tidak disengaja |
