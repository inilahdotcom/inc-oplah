# ASSUMPTIONS.md

Keputusan yang tidak dijawab dokumen acuan (PRD §0.6, AGENT.md §1). Format: tanggal · konteks · keputusan · alasan.

| Tanggal | Konteks | Keputusan | Alasan |
|---|---|---|---|
| 2026-09-25 | Lokasi frontend | Template Vite di root dipindah ke `apps/web` | Diminta user; sesuai struktur monorepo ARCHITECTURE §3 |
| 2026-09-25 | Package manager | **bun** workspaces (`workspaces` + `trustedDependencies` di root `package.json`). Runtime API tetap Node.js lewat `tsx`; bun hanya sebagai package manager & script runner | Diminta user (menggantikan pnpm). PRD §11 masih menyebut pnpm; dokumen PRD tidak diubah |
| 2026-09-25 | Framework HTTP | Express **5** (bukan 4) | Express 5 meneruskan error dari handler `async` ke error handler; Express 4 butuh wrapper di setiap route. `validate()` menimpa `req.query` lewat `defineProperty` karena di Express 5 berupa getter |
| 2026-09-25 | Object storage | **DigitalOcean Spaces** (S3) untuk dev & produksi, bucket terpisah; tanpa MinIO. Kredensial `S3_*` opsional: kosong → endpoint upload membalas 503 `STORAGE_NOT_CONFIGURED`; gagal koneksi → 502 `STORAGE_ERROR`. Test API me-mock storage | Keputusan user. Image MinIO tidak lagi bisa di-pull tanpa login |
| 2026-09-25 | Test API | Database terpisah `inc_mo_test` (bukan schema terpisah) | Ekstensi `pg_trgm` terpasang di schema `public`, sehingga `gin_trgm_ops` tidak terlihat dari schema lain dan migration gagal |
| 2026-09-25 | FR-AUTH-02 lupa password | Ditunda; `/lupa-password` berisi arahan menghubungi Super Admin | Butuh SMTP dan tabel token reset yang belum ada di DATABASE.md |
| 2026-09-25 | Refresh token | Token acak, disimpan hash SHA-256, dirotasi tiap pakai. Token yang sudah dicabut dipakai ulang → semua sesi user dicabut | Deteksi pencurian token. Efek samping: dua tab yang me-refresh di milidetik yang sama bisa sama-sama logout |
| 2026-09-25 | `JWT_REFRESH_SECRET` | Tidak dipakai, dihapus dari `.env.example` | Refresh token bukan JWT (ARCHITECTURE §4.2) |
| 2026-09-25 | Endpoint tambahan | `GET /auth/me` | Web butuh profil user; dipakai juga untuk verifikasi token |
| 2026-09-25 | Filter `organization_id` otomatis via Prisma `$extends` | Ditunda ke M2 | M1 hanya query `users` dan sudah difilter manual dari token |
| 2026-09-25 | Seed MO contoh PRD §14 | Ditunda ke M3 | Butuh `tax.service`; klien contoh PTBA sudah di-seed |
| 2026-09-25 | Akun seed | `superadmin@inilah.local` selalu dibuat; `sales@`, `finance@`, `viewer@inilah.local` hanya di non-production. Password dari `SEED_PASSWORD` (default `password123`) | DATABASE.md §8 |
| 2026-09-25 | Nav Master data untuk Admin Sales | Tidak ditampilkan; hanya SUPER_ADMIN | Prototipe menampilkannya sebagai pratinjau, tetapi README desain §8 menyatakan produksi hanya SUPER_ADMIN |
| 2026-09-25 | Role switcher & tombol Notifikasi di top bar | Role switcher tidak dibuat (role dari token). Notifikasi menyusul di M4 | Switcher hanya alat prototipe |
| 2026-09-25 | Font | Inter (Google Fonts) + JetBrains Mono | Token tipografi; Söhne yang tersedia hanya Bold Italic (aksen tanda tangan PDF) |
| 2026-09-25 | shadcn | Style `base-nova` (Base UI). `button.tsx` & `input.tsx` diubah ke pill/tinggi 40px Stripi | Pengecualian AGENT.md §4: perbaikan yang diminta DESIGN.md (pill button, jangan rounded-rect) |
| 2026-09-25 | Master data: hapus | Tidak ada hard delete; dinonaktifkan via `isActive` | Sales, penandatangan, benefit, dan opsi direferensikan MO lama (FK / kode di `selected_options`) |
| 2026-09-25 | Kode benefit & opsi formulir | Dibuat otomatis dari nama bila kosong (`YouTube Shorts` → `YOUTUBE_SHORTS`) dan tidak bisa diubah setelah dibuat | Kode dipakai sebagai kolom laporan Finance & tersimpan di MO |
| 2026-09-25 | PATCH master data & klien | Body berisi objek lengkap (skema sama dengan POST) | Skema Zod ber-default tidak aman di-`partial()` (default akan menimpa nilai lama) |
| 2026-09-25 | Field wajib klien | Perusahaan, PIC, Email, No. Telp (mengikuti modal desain); NIK 16 digit & kode pos 5 digit bila diisi | PRD FR-CL-01 tidak menyebut field wajib; desain menandai 4 field tersebut |
| 2026-09-25 | NIK klien | API mengembalikan NIK utuh hanya untuk role dengan izin `manageClients`; Finance/Viewer menerima versi masked. UI detail selalu menampilkan masked | Data sensitif (PRD §12) |
| 2026-09-25 | Deteksi duplikat klien | Normalisasi nama (port `norm()` prototipe) dibandingkan di aplikasi terhadap semua klien org; hanya peringatan, tidak memblokir | Cukup untuk ribuan klien; ganti ke pg_trgm `similarity()` bila > ~50rb (ditandai `ponytail:` di kode) |
| 2026-09-25 | Upload TTD/stempel | PNG saja, maks 2 MB, dicek dari magic bytes. Stempel hanya untuk peran "Disetujui oleh". Nama file diberi timestamp agar cache signed URL lama tidak menampilkan gambar usang | PRD FR-MD-02 (PNG transparan) |
| 2026-09-25 | Kelola pengguna | Tab Pengguna ikut M2 (tambah, ubah role/tautan sales, nonaktifkan, ganti password). Nonaktif atau ganti password mencabut semua sesi. SA tidak bisa menonaktifkan/mengubah role akun sendiri | Keputusan user; tanpa ini akun baru hanya lewat seed |
| 2026-09-25 | `GET /settings` | Hanya Super Admin di M2 | Sesuai PRD §10. Form MO (M3) yang butuh template T&C & tarif akan diberi endpoint baca terpisah bila perlu |
| 2026-09-25 | Tabel M2 | shadcn `table` biasa; TanStack Table dipakai di M5 untuk tabel Finance (kolom dinamis, sort) | Daftar klien & pengguna tidak butuh fitur tabel lanjutan |
| 2026-09-25 | Komponen shadcn yang diubah | `dialog`, `alert-dialog`, `table`, `textarea` diselaraskan ke spesifikasi modal/tabel README desain; `@hookform/resolvers` v5 agar tipe input/output Zod terbaca | Pengecualian AGENT.md §4 |
