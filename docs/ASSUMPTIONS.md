# ASSUMPTIONS.md

Keputusan yang tidak dijawab dokumen acuan (PRD §0.6, AGENT.md §1). Format: tanggal · konteks · keputusan · alasan.

| Tanggal | Konteks | Keputusan | Alasan |
|---|---|---|---|
| 2026-09-25 | Lokasi frontend | Template Vite di root dipindah ke `apps/web` | Diminta user; sesuai struktur monorepo ARCHITECTURE §3 |
| 2026-09-25 | Package manager | **bun** workspaces (`workspaces` + `trustedDependencies` di root `package.json`). Runtime API tetap Node.js lewat `tsx`; bun hanya sebagai package manager & script runner | Diminta user (menggantikan pnpm). PRD §11 masih menyebut pnpm; dokumen PRD tidak diubah |
| 2026-09-25 | Framework HTTP | Express **5** (bukan 4) | Express 5 meneruskan error dari handler `async` ke error handler; Express 4 butuh wrapper di setiap route. `validate()` menimpa `req.query` lewat `defineProperty` karena di Express 5 berupa getter |
| 2026-09-25 | Object storage | **DigitalOcean Spaces** (S3) untuk dev & produksi, bucket terpisah; tanpa MinIO. Kredensial `S3_*` opsional: kosong → endpoint upload membalas 503 `STORAGE_NOT_CONFIGURED`; gagal koneksi → 502 `STORAGE_ERROR`. Test API me-mock storage | Keputusan user. Image MinIO tidak lagi bisa di-pull tanpa login |
| 2026-09-25 | Test API | Database terpisah `inc_mo_test` (bukan schema terpisah) | Ekstensi `pg_trgm` terpasang di schema `public`, sehingga `gin_trgm_ops` tidak terlihat dari schema lain dan migration gagal |
| 2026-09-25 | FR-AUTH-02 lupa password | Reset via email (SMTP_URL). Token JWT stateless 30 menit yang ditandatangani dengan secret + hash password, sehingga sekali pakai tanpa tabel token. Tanpa SMTP_URL, email ditulis ke log (non-produksi) | Tidak perlu migrasi. Tambah tabel token bila admin perlu melihat/mencabut link yang tertunda |
| 2026-09-25 | Refresh token | Token acak, disimpan hash SHA-256, dirotasi tiap pakai. Token yang sudah dicabut dipakai ulang → semua sesi user dicabut | Deteksi pencurian token. **2026-09-26:** token hasil rotasi tetap diterima 30 detik (`revokedAt` diisi waktu masa depan) agar reload/dua tab/respons yang tidak sampai tidak memicu logout massal; logout, nonaktif, dan ganti password tetap mencabut seketika |
| 2026-09-25 | `JWT_REFRESH_SECRET` | Tidak dipakai, dihapus dari `.env.example` | Refresh token bukan JWT (ARCHITECTURE §4.2) |
| 2026-09-25 | Endpoint tambahan | `GET /auth/me` | Web butuh profil user; dipakai juga untuk verifikasi token |
| 2026-09-25 | Filter `organization_id` otomatis via Prisma `$extends` | Ditunda ke M2 | M1 hanya query `users` dan sudah difilter manual dari token |
| 2026-09-25 | Seed MO contoh PRD §14 | Ditunda ke M3 → **selesai di M3** sebagai Draft (tidak memakai nomor urut) | Butuh `tax.service`; klien contoh PTBA sudah di-seed |
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
| 2026-09-25 | `GET /settings` | Hanya Super Admin di M2; **M3: dibuka untuk izin `editMo` (SA + Admin Sales)**, PATCH tetap SA | Form MO butuh tarif, template T&C, dan pratinjau nomor; tanpa endpoint baca terpisah |
| 2026-09-25 | Tabel M2 | shadcn `table` biasa; TanStack Table dipakai di M5 untuk tabel Finance (kolom dinamis, sort) | Daftar klien & pengguna tidak butuh fitur tabel lanjutan |
| 2026-09-25 | Komponen shadcn yang diubah | `dialog`, `alert-dialog`, `table`, `textarea` diselaraskan ke spesifikasi modal/tabel README desain; `@hookform/resolvers` v5 agar tipe input/output Zod terbaca | Pengecualian AGENT.md §4 |
| 2026-09-26 | Aritmetika pajak | `Prisma.Decimal` (decimal.js yang dibundel `@prisma/client`), bukan dependensi `decimal.js` terpisah. Nominal dikirim sebagai string Rupiah penuh | Library yang sama tanpa dependensi baru (AGENT.md §3) |
| 2026-09-26 | Template PDF | Fungsi TS template literal (`mo-pdf.ts`) + escape HTML, bukan Handlebars. Satu dependensi baru: `puppeteer` (Chromium ikut terunduh; `PUPPETEER_EXECUTABLE_PATH` dipakai bila di-set) | PRD §8 mewajibkan render backend; satu template tidak butuh engine |
| 2026-09-26 | PDF: font mengecil hingga 7pt | Tidak diimplementasikan; font tetap 8,5pt dan isi yang panjang mengalir ke halaman 2 | MO contoh muat 1 halaman; tambahkan bila MO nyata tidak muat |
| 2026-09-26 | PDF: garis bawah header | Merah (`#ea2261`) sesuai PRD §8, bukan indigo seperti prototipe | PRD di atas desain (AGENT.md §1) |
| 2026-09-26 | Nama file PDF | Isi kurung dibuang, sisanya dipertahankan: `PT Bukit Asam Tbk (PTBA)` → `PT_BUKIT_ASAM_TBK`. Contoh PRD (`PT_BUKIT_ASAM`) juga membuang "Tbk" tanpa aturan tertulis | Aturan paling sederhana yang deterministik |
| 2026-09-26 | Penomoran MO | Satu statement `INSERT … ON CONFLICT DO UPDATE SET last_seq = last_seq + 1 RETURNING` di dalam transaksi submit, bukan `SELECT … FOR UPDATE` terpisah | Row lock yang sama (dipegang sampai commit) tanpa celah saat baris tahun baru belum ada; teruji 20 submit paralel |
| 2026-09-26 | Status machine | Tabel transisi + `assertTransition()` / `lockMo()` di `media-orders.service.ts` (diekspor untuk M4), bukan file terpisah | Satu tabel kecil; semua perubahan status tetap lewat satu pintu |
| 2026-09-26 | Revisi | Hanya dari SUBMITTED/ACTIVE yang belum BILLED/PAID; satu MO hanya bisa direvisi sekali (MO lama jadi CANCELLED) | Tabel status PRD §4; DATABASE.md relasi revisi 1:1 |
| 2026-09-26 | Data klien di MO | Snapshot diisi dari form (bisa diedit) dan disimpan sejak draft; validasi field wajib klien saat submit | PRD §6 Section B memuat field klien di form MO |
| 2026-09-26 | Lampiran MO | Satu file per request (web mengunggah berurutan untuk multi-file); PDF/JPG/PNG dicek magic bytes, maks 10 MB; hanya untuk MO non-Draft & non-Batal | FR-MO-12, ARCHITECTURE §4.6 |
| 2026-09-26 | Daftar MO `/mo` | Tetap M5; di M3 MO diakses dari detail klien | PRD §13 menempatkan daftar & filter di M5 |
| 2026-09-26 | `S3_ENDPOINT` tanpa skema | Dianggap `https://` | `.env` berisi host saja → S3 client gagal "Invalid URL" dan upload/penyimpanan PDF final tidak jalan |
| 2026-09-26 | Versi React | **React 19.3.0** (permintaan user). Library lain tetap di major sekarang (react-router 6, sonner 1, lucide 0.x) karena peer dependency-nya sudah menerima React 19. `Input`/`Textarea` kembali ke function component biasa (di React 19 `ref` adalah prop) | Tidak menaikkan major yang tidak diperlukan |
| 2026-09-26 | Normalisasi URL realisasi | Selain aturan DATABASE.md (host huruf kecil, tanpa `utm_*`, tanpa garis miring akhir) juga membuang `www.` dan `#hash` | `inilah.com/x` dan `www.inilah.com/x/#top` adalah artikel yang sama |
| 2026-09-26 | Input massal realisasi | Server memvalidasi per URL: yang lolos disimpan, sisanya dikembalikan dengan alasan (tidak all-or-nothing). Web menampilkan pratinjau yang sama sebelum simpan | Desain: "x dari y URL siap disimpan" |
| 2026-09-26 | Kuota realisasi | Dicek di server di bawah row lock MO; bonus tidak dihitung ke % pemenuhan. Edit realisasi mengecek ulang kuota & URL ganda | FR-PUB-03/04 |
| 2026-09-26 | Status otomatis M4 | `recalcFulfillment` (satu fungsi) dipanggil di transaksi setiap perubahan realisasi, saat revisi, dan saat submit draft revisi: SUBMITTED→ACTIVE (realisasi/lampiran pertama), ACTIVE→COMPLETED (semua 100%), COMPLETED→ACTIVE (turun & belum BILLED); penagihan NOT_READY⇄READY_TO_BILL, BILLED/PAID tidak disentuh | PRD §5.7, ARCHITECTURE §4.3 |
| 2026-09-26 | Notifikasi | In-app saja; web polling tiap 60 detik. Notifikasi H-30 akhir periode (job terjadwal) menyusul M6 | PRD §13 menempatkan notifikasi H-30 di M6 |
| 2026-09-26 | Detail MO | Tab: Realisasi publikasi · Ringkasan MO · Lampiran. Tab Penagihan menyusul M5, riwayat audit M6 | Sesuai milestone |
| 2026-09-26 | Daftar MO | Satu halaman `/mo` untuk semua role (desain §3), bukan `/finance` terpisah (ARCHITECTURE). Endpoint `GET /media-orders` + ekspor `GET /finance/media-orders/export` memakai filter yang sama. Draft ikut tampil (bisa difilter status); chip penagihan tidak menghitung Draft/Dibatalkan; footer tanpa Dibatalkan | Desain lebih baru & satu daftar lebih sederhana |
| 2026-09-26 | Ekspor Excel | ExcelJS, workbook di memori (maks 20 rb baris), bukan mode streaming | Volume MO jauh di bawah batas; ditandai `ponytail:` |
| 2026-09-26 | Penagihan | Nominal tagihan tidak boleh melebihi sisa belum ditagih. Menagih saat `NOT_READY` wajib alasan (`override_reason`) dan memberi notifikasi `MO_BILLING_OVERRIDE` ke Super Admin. PAID bila total dibayar ≥ total MO | FR-FIN-05, enum notifikasi yang sudah ada |
| 2026-09-26 | Dashboard | Grafik batang dengan CSS, tanpa library chart | 12 batang sederhana |
| 2026-09-26 | Job terjadwal | Interval dalam proses API tiap jam (idempoten, advisory lock) menggantikan cron 08:00/02:00 | Tanpa dependensi scheduler; ditandai `ponytail:` |
| 2026-09-26 | Riwayat audit | Tab "Lampiran & riwayat" menampilkan audit MO + realisasi + tagihan (dicocokkan lewat `mediaOrderId` di JSON audit), maks 200 entri | FR-AUD-01 |
| 2026-09-26 | E2E | Playwright (`bun run e2e`) memakai DB dev dan membuat data uji sendiri (klien `PT E2E …`) | PRD §13 M6 |
| 2026-09-26 | Deployment | Dokumen untuk satu server + nginx (origin sama, `/api` di-proxy). Dockerfile belum dibuat | Platform hosting belum ditentukan |
