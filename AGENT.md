# AGENT.md

Panduan kerja untuk AI coding agent di project **Sistem Manajemen Klien & Media Order (MO) Inilah.com**.
Baca file ini sampai selesai sebelum mengubah kode apa pun.

## 1. Dokumen Acuan

Baca dokumen di bawah sesuai urutan. Jika isinya bertentangan, dokumen yang lebih atas menang.

| Urutan | File | Isi |
|---|---|---|
| 1 | `AGENT.md` | Aturan kerja (file ini) |
| 2 | `docs/PRD.md` | Kebutuhan produk, alur, acceptance criteria |
| 3 | `DATABASE.md` | Skema, constraint, query penting |
| 4 | `ARCHITECTURE.md` | Struktur kode, lapisan, pola |
| 5 | `DESIGN.md` | Tampilan, komponen UI, token desain |

Jika sebuah kebutuhan tidak dijawab dokumen mana pun, pilih solusi paling sederhana yang konsisten dengan dokumen yang ada. Catat keputusan itu di `docs/ASSUMPTIONS.md` dengan format: tanggal, konteks, keputusan, alasan.

## 2. Kondisi Codebase Saat Ini

- Frontend **sudah ada**: React + Vite + TypeScript, dengan shadcn/ui untuk styling.
- Backend dan database **belum ada**. Keduanya dibangun sesuai `ARCHITECTURE.md` dan `DATABASE.md`.
- Sebelum menulis kode, jalankan inspeksi berikut dan sesuaikan pekerjaan dengan hasilnya. Jangan menata ulang struktur yang sudah ada tanpa alasan kuat.
  ```bash
  cat package.json
  ls -la
  cat components.json        # konfigurasi shadcn
  ls src/components/ui       # komponen shadcn yang sudah terpasang
  ```
- Jika lokasi frontend berbeda dari `apps/web` (misalnya masih di root repo), **pindahkan ke `apps/web` hanya jika diminta**. Kalau tidak diminta, sesuaikan path di dokumen ini secara mental dan catat di `docs/ASSUMPTIONS.md`.

## 3. Aturan Wajib (Non-Negotiable)

1. **Uang tidak boleh memakai `float`.** Gunakan `decimal.js` di Node dan `NUMERIC(18,2)` di PostgreSQL. Di JSON API, nominal dikirim sebagai **string** (contoh `"20000000.00"`). Frontend hanya menampilkan dan tidak pernah menghitung nilai final.
2. **Rumus pajak hanya ada di satu tempat**, yaitu `apps/api/src/modules/tax/tax.service.ts`:
   ```
   DPP   = ROUND_HALF_UP(Subtotal × 11/12)
   PPN   = ROUND_HALF_UP(DPP × 12%)
   Total = Subtotal + PPN
   ```
   Test wajib: Subtotal 20.000.000 menghasilkan DPP 18.333.333, PPN 2.200.000, dan Total 22.200.000.
3. **Otorisasi di backend.** Setiap route wajib memakai middleware `requireRole(...)`. Menyembunyikan tombol di frontend hanyalah UX, bukan keamanan.
4. **MO yang sudah submit bersifat immutable.** Endpoint update mengembalikan `409 MO_LOCKED` bila status MO bukan `DRAFT`. Koreksi hanya lewat alur *revisi*.
5. **Nomor MO digenerate di dalam transaksi** dengan `SELECT ... FOR UPDATE` pada `mo_sequences`. Jangan membuat nomor dari `COUNT(*)`.
6. **Snapshot data.** Saat submit, data klien, penandatangan, dan tarif pajak disalin ke kolom snapshot pada `media_orders`.
7. **Selalu filter `organization_id`.** Setiap query ke tabel tenant wajib memakainya. Nilainya diambil dari token user, bukan dari body request.
8. **Setiap mutasi penting menulis audit log**: create, update, delete, submit, cancel, revise, perubahan billing, dan perubahan publikasi.
9. **Jangan commit secret.** Semua konfigurasi dibaca dari `.env`, dan setiap variabel baru didokumentasikan di `.env.example`.
10. **Jangan menambah dependency besar tanpa alasan.** Utamakan library yang sudah tercantum di `ARCHITECTURE.md`. Jika perlu library baru, catat alasannya di `docs/ASSUMPTIONS.md`.

## 4. Aturan Frontend

- **Styling**: shadcn/ui + Tailwind, mengikuti token dan pola di `DESIGN.md`. Jangan membuat CSS custom atau komponen UI dari nol jika sudah ada padanannya di shadcn.
- **Menambah komponen shadcn**: `npx shadcn@latest add <nama>`. Jangan menyalin kode komponen secara manual dari internet.
- **Jangan mengedit file di `src/components/ui/`** kecuali untuk perbaikan yang diminta `DESIGN.md`. Komponen komposit ditaruh di `src/components/` atau di dalam folder fitur.
- **Form**: React Hook Form + `zodResolver`. Skema Zod diimpor dari `@inc/shared`, tidak ditulis ulang di frontend.
- **Data fetching**: TanStack Query. Semua pemanggilan API lewat `src/lib/api-client.ts`, tidak memanggil `fetch` langsung dari komponen.
- **Tabel**: shadcn Data Table (TanStack Table).
- **Teks UI** dalam Bahasa Indonesia. Tanggal ditulis `22 Mei 2026`, Rupiah ditulis `Rp 20.000.000` (tanpa desimal). Pakai util `formatRupiah` dan `formatTanggal` dari `@inc/shared`.
- **Tiga state wajib** di setiap halaman yang memuat data: loading (skeleton), kosong (empty state), dan error (pesan + tombol coba lagi).
- **Notifikasi aksi** memakai toast (`sonner`). Aksi destruktif (hapus, batal, revisi) wajib memakai `AlertDialog`.

## 5. Aturan Backend

- Struktur modular per domain (lihat `ARCHITECTURE.md` §4). Alurnya: route → controller (tipis) → service (logika bisnis) → Prisma.
- Validasi setiap input dengan Zod dari `@inc/shared` di middleware `validate(schema)`.
- Semua error dilempar sebagai `AppError(code, message, httpStatus, details?)` dengan format response:
  ```json
  { "error": { "code": "MO_LOCKED", "message": "MO sudah disubmit dan tidak bisa diubah", "details": [] } }
  ```
- Operasi multi-tabel (submit, revisi, input realisasi, billing) wajib dibungkus `prisma.$transaction`.
- Jangan pernah menaruh NIK, password, atau token di log.

## 6. Konvensi Kode

| Hal | Konvensi |
|---|---|
| Bahasa kode | Inggris (nama variabel, fungsi, tabel) |
| Bahasa UI & pesan error | Indonesia |
| File | `kebab-case.ts`; komponen React `PascalCase.tsx` |
| Kolom DB | `snake_case`; field Prisma `camelCase` dengan `@map` |
| Enum | `UPPER_SNAKE_CASE` |
| API | REST, prefix `/api/v1`, resource bentuk jamak dengan kebab-case |
| Tanggal | Disimpan UTC; ditampilkan dalam zona `Asia/Jakarta` |
| Commit | Conventional Commits: `feat(mo): ...`, `fix(finance): ...` |

TypeScript `strict: true`. Tidak boleh ada `any` kecuali di boundary library, dan setiap pemakaiannya diberi komentar alasan.

## 7. Perintah Umum

```bash
bun install
cd apps/api && bun run prisma migrate dev   # dari apps/api
bun run db:seed                      # dari apps/api
bun run dev                          # web + api paralel (dari root)
bun run lint && bun run typecheck && bun run test
bun --filter web test:e2e            # Playwright
```

Jika sebuah script belum ada, buat script tersebut di `package.json` yang relevan.

## 8. Alur Kerja per Tugas

1. Baca bagian PRD yang relevan dan acceptance criteria milestone yang sedang dikerjakan.
2. Jika tugas mengubah skema: perbarui `DATABASE.md` terlebih dahulu, lalu buat migration Prisma. Jangan mengedit migration yang sudah pernah diterapkan.
3. Kerjakan urutan **shared schema → backend → test backend → frontend → test**.
4. Jalankan `bun run lint && bun run typecheck && bun run test` sampai semuanya hijau.
5. Perbarui dokumentasi yang terdampak (`ARCHITECTURE.md`, `DATABASE.md`, `.env.example`).
6. Laporkan: apa yang dikerjakan, file yang diubah, asumsi baru, dan hal yang belum selesai.

## 9. Definition of Done

Sebuah tugas dianggap selesai jika semua poin berikut terpenuhi:

- [ ] Acceptance criteria di PRD untuk fitur tersebut terpenuhi.
- [ ] Lint, typecheck, dan test lulus.
- [ ] Endpoint baru punya test Supertest untuk kasus sukses, validasi gagal, dan akses ditolak (403).
- [ ] Logika bisnis baru (pajak, penomoran, pemenuhan benefit, transisi status) punya unit test.
- [ ] Halaman baru punya state loading, kosong, dan error, serta responsif sesuai `DESIGN.md`.
- [ ] Tidak ada `console.log` sisa debug, dan tidak ada TODO tanpa referensi.
- [ ] Dokumentasi terdampak sudah diperbarui.

## 10. Hal yang Dilarang

- Menghitung pajak atau total di frontend lalu mengirimnya ke backend sebagai nilai final.
- Menghapus data MO yang sudah submit secara fisik (hard delete).
- Mengubah `mo_number` setelah submit.
- Menulis query SQL mentah dengan interpolasi string. Gunakan Prisma atau `Prisma.sql` dengan parameter.
- Membuat design system baru di luar `DESIGN.md`.
- Mengerjakan fitur yang tercantum di PRD §15 (fase berikutnya) tanpa diminta.
