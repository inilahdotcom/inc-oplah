# Handoff: Inilah Client & Media Order Management (Oplah)

## Overview
Aplikasi internal PT Indonesia News Center (Inilah.com) untuk mengelola klien, membuat dokumen Media Order (MO), mencatat realisasi publikasi (benefit), dan memantau status penagihan. Role pada prototipe: **Admin Sales** dan **Finance** (Super Admin hanya dipratinjau lewat halaman Master data). Kebutuhan fungsional lengkap ada di `PRD.md`, yang menjadi sumber kebenaran untuk logika bisnis, API, dan skema database.

## About the Design Files
File di bundle ini adalah **referensi desain yang dibuat dalam HTML**: prototipe yang menunjukkan tampilan dan perilaku yang dimaksud, **bukan kode produksi untuk disalin langsung**. Tugasnya adalah **membangun ulang desain ini di stack target PRD**: React 18 + TypeScript + Vite, React Router, TanStack Query/Table, React Hook Form + Zod, Tailwind + shadcn/ui, dengan backend Node.js + PostgreSQL. Gunakan pola dan library yang sudah dipakai di stack tersebut.

- `Oplah Media Order.dc.html` hanya berjalan di tool desain (runtime `support.js`), jadi baca markup dan class logic-nya sebagai spesifikasi, bukan untuk dijalankan.
- `oplah-data.js` berisi data seed, helper format (Rupiah, tanggal Indonesia), dan rumus pajak versi frontend. Di produksi, **perhitungan uang wajib di backend** dengan decimal/integer (PRD §0.2, §7).

## Fidelity
**High-fidelity.** Warna, tipografi, spacing, radius, dan interaksi sudah final dan mengikuti design system "Stripi" (token di `tokens/`, komponen referensi di `ds_reference/`). Bangun ulang sedekat mungkin; petakan token ke Tailwind theme / CSS variables.

## Global layout (app shell)
- **Sidebar** (lebar ≥ 900px): lebar 232px, `background #1c1e54`, padding 18px 12px, sticky, tinggi 100vh. Isinya logo kotak 24px (`#533afd`, radius 6px, huruf "i") + "Inilah.com" / "Media Order". Item nav: 14px/400, padding 8px 10px, radius 6px. Item aktif: bg `rgba(255,255,255,0.1)`, teks #fff. Item non-aktif: teks `rgba(255,255,255,0.72)`. Di bawah ada "PT Indonesia News Center" dan link "Keluar".
  - Nav Admin Sales: Daftar MO, Buat MO, Klien, Master data.
  - Nav Finance: Dashboard, Daftar MO (badge "n siap"), Klien, Master data.
- **Top bar**: tinggi 56px, border-bottom 1px `#e3e8ee`, sticky. Isinya breadcrumb (14px, `#64748d`), switcher role berbentuk pill segmented (aktif `#533afd`/putih), tombol "Notifikasi" + badge jumlah belum dibaca (`#ea2261` bila > 0), dan avatar inisial (30px, navy) + nama/role.
- **< 900px**: sidebar diganti baris pill nav horizontal yang bisa di-scroll, di bawah top bar. Padding main berubah dari `28px 32px 64px` menjadi `20px 16px 56px`. Max-width main 1440px.
- Judul halaman: 26px/300, line-height 1.12, letter-spacing −0.26px. Eyebrow: 14px/400, warna `#533afd`.

## Screens / Views

### 1. Login
- Latar GradientMesh "hero" full-screen. Di tengahnya card putih max-width 420px (padding 32px, radius 12px, shadow L2, gap 20px).
- Isi card: judul "Masuk ke akun Anda", TextInput Email dan Password, link "Lupa password?", Button primary "Masuk ›", lalu kotak "Akun demo prototipe".
- Validasi: kedua field wajib diisi. Error ditampilkan di TextInput password.
- Setelah login, Finance masuk ke Dashboard, sedangkan Admin Sales masuk ke Daftar MO.

### 2. Dashboard Finance (FR-FIN-07)
- **4 KPI card**: grid `auto-fit minmax(220px,1fr)` dengan gap 12px. Card: padding 20px, radius 12px, shadow L1; saat hover border berubah jadi `#533afd`. Isi card: label 13px mute, nilai 26px tnum, sub 13px.
  - MO terbit 2026
  - Nilai kontrak 2026 (setelah PPN)
  - Siap ditagih → klik membuka Daftar MO dengan filter READY_TO_BILL
  - Piutang (BILLED belum PAID) → klik membuka Daftar MO dengan filter BILLED
- **Grafik batang** nilai MO per bulan (Jan–Des): 12 kolom, tinggi 200px, batang `#533afd` dengan radius 4px 4px 0 0. Label nilai singkat ("45 jt") di atas batang; nama bulan dan jumlah MO di bawah.
- **Dua list**: "Siap ditagih" dan "Periode berakhir ≤ 30 hari, belum terpenuhi". Tiap baris berisi nomor MO, perusahaan, dan nominal atau %.

### 3. Daftar Media Order (FR-FIN-01..06)
- **Header**: judul + "n MO sesuai filter". Aksi: Ekspor CSV dan Ekspor Excel (secondary sm), serta Buat MO (primary, hanya Admin Sales).
- **Chip status penagihan** (quick filter 1 klik, FR tujuan §2): Semua, Belum siap, Siap ditagih, Sudah ditagih, Lunas. Chip aktif memakai border 1.5px `#533afd`. Hitungan tidak menyertakan draft dan MO dibatalkan.
- **Filter bar** (bg `#f6f9fc`, radius 12px, padding 16px, wrap):
  - Segmented "Tanggal MO | Periode tayang"
  - Month "Dari" dan "Sampai". Mode periode memakai logika overlap: `pe ≥ from && ps ≤ to`.
  - Select Perusahaan, Sales, Status MO, Status penagihan, dan Pemenuhan
  - Input pencarian dan tombol Reset
- **Tabel** (min-width 1560px, bisa scroll horizontal): kolom mengikuti PRD §5.8. Header 12px/400 mute dengan bg `#f6f9fc`; sel 14px tnum, letter-spacing −0.42px; hover baris bg `#f6f9fc`.
  - Kolom benefit dibangkitkan dari master `benefit_types`. Sel berupa chip radius 4px: hijau (`#d7f7c2`/`#05690d`) bila terpenuhi, kuning (`#fcedb9`/`#a82c00`) bila sebagian, abu (`#f6f9fc`/`#64748d`) bila belum ada realisasi, dan "—" bila benefit tidak ada di MO.
  - Status MO dan Status penagihan ditampilkan sebagai Tag.
  - **Footer** berisi total Sebelum PPN, PPN, dan Setelah PPN (tanpa MO dibatalkan).
  - Klik baris membuka Detail MO. Finance langsung masuk ke tab Penagihan.
- Di bawah tabel ada legenda warna.

### 4. Form Buat / Edit / Revisi MO (FR-MO-01..08, PRD §6)
- **Layout**: dua kolom `minmax(0,1fr) 320px` pada ≥ 1200px (aside sticky di top 76px); di bawah itu satu kolom. Tiap section adalah card (padding 24px, radius 12px) dengan huruf section A–F (12px indigo) dan judul 18px/300.
- **A Header**: No. MO berupa kotak dashed bertuliskan "(otomatis)", lalu Tanggal (date, default hari ini).
- **B Data klien**:
  - Select klien tersimpan (mengisi snapshot) dan tombol "Tambah klien baru" (membuka modal klien, lalu otomatis terpilih).
  - Grid `auto-fit minmax(240px,1fr)` berisi Nama PIC\*, Perusahaan\*, NIK (16 digit), Alamat, Kota, Kode Pos (5 digit), Email\*, No. Telp\*.
- **C Periode**: bulan mulai\*, bulan sampai\*, Keterangan\*.
- **D Detail iklan**:
  - Tanggal tayang (teks bebas)
  - Checkbox Jenis iklan (7), Bentuk kerjasama (single, boleh kosong), dan Penempatan (3)
  - Kotak Lokasi iklan (bg soft): Spot Ads Website dengan 9 opsi anak yang disabled bila induk tidak dicentang, serta Spot Ads Mobile
  - **Benefit**: baris dinamis dengan grid `minmax(160px,2fr) 90px minmax(140px,2fr) auto` (select jenis, qty, catatan, Hapus), plus tombol "+ Tambah benefit"
  - **Detail kerjasama** (textarea, maks. 4 baris): otomatis dari benefit dengan format `"{Nama}{ (catatan)} {qty}x"`. Setelah diedit manual, isinya tidak ditimpa lagi. Link "Isi ulang dari benefit" mengembalikan isi otomatis.
  - **T&C** (maks. 10 baris, ada penghitung baris) dengan select template + "Pakai template".
- **E Pembayaran**: Cara pembayaran (Transfer / Cek/BG; "Cek/BG No" muncul dan wajib bila Cek/BG), Kwitansi No, Jatuh tempo, Produk iklan, Subtotal\* (prefix Rp, diformat titik ribuan), dan toggle "Kena PPN" (default ON).
- **F Penandatangan**: Dibuat oleh (sales), Diketahui oleh (default Fitriyanti K), Disetujui oleh (default Alvin Alverdian).
- **Aside**:
  - Card "Biaya pemasangan" (shadow L2): Subtotal, DPP 11/12, PPN 12% (+), dan Total payment 22px. DPP dan PPN disembunyikan bila tidak kena PPN.
  - Card "Nomor MO bila disubmit sekarang".
  - Tombol: Submit MO (lg primary ›), Simpan draft (secondary), Pratinjau PDF (ghost).
- **Validasi** hanya berjalan saat Submit (FR-MO-07). Hasilnya berupa banner merah daftar isian di atas form dan pesan error per field.

### 5. Detail MO
- **Header**:
  - Link "← Daftar MO", nomor MO 26px tnum, Tag status MO, Tag status penagihan, nama perusahaan, dan catatan revisi.
  - Aksi sesuai role/status: Unduh PDF (semua), Hapus draft + Lanjutkan edit (draft, AS), Duplikat (AS), Revisi (AS, belum ditagih), Batalkan MO (AS, SUBMITTED/ACTIVE, ghost merah), Tandai sudah ditagih (FIN).
- **Strip ringkasan**: 4 sel (4 kolom ≥ 1100px, 2×2 di bawahnya) berisi Total payment, Masa periode, Sales, dan Pemenuhan (progress bar 6px pill).
- **Tab** (underline 2px indigo): Realisasi publikasi · Ringkasan MO · Penagihan · Lampiran & riwayat.
  - **Realisasi**:
    - Card per benefit berisi nama, `f/qty`, progress bar (indigo, hijau `#15be53` bila 100%), catatan, dan jumlah bonus.
    - Tombol "Input massal" dan "Tambah realisasi" (AS, status SUBMITTED/ACTIVE/COMPLETED, belum BILLED).
    - List entri: tanggal, jenis, judul, URL (link), Tag Bonus, Tag "Di luar periode", dan Hapus.
    - Info bar untuk Finance (read-only) dan untuk MO yang sudah ditagih (terkunci).
  - **Ringkasan**: 6 card key-value (Header, Data klien, Periode, Detail iklan, Pembayaran, Penandatangan) dalam 2 kolom.
  - **Penagihan**: 4 stat (Total MO, Sudah ditagih, Diterima, Sisa), catatan status, dan tabel tagihan (invoice, tgl, nominal, tgl bayar, diterima, kwitansi, "Catat pembayaran"). Baris dengan override menampilkan alasan berwarna warning.
  - **Lampiran & riwayat**: daftar dokumen dengan area upload dashed (PDF/JPG/PNG ≤ 10 MB, multi-file), plus audit log (aksi, user · waktu).

### 6. Modal
Semua modal: overlay `rgba(13,37,61,0.28)`, panel max-width 540px (radius 12px, shadow L2), header dengan "Tutup", dan footer dengan Batal + aksi primary.
- **Tambah realisasi**: jenis (hanya benefit di MO), tanggal, judul, URL\*, screenshot (≤ 5 MB), catatan, checkbox "Bonus / melebihi kontrak".
- **Input massal**: jenis, tanggal, textarea URL satu per baris (mono), checkbox bonus. Pratinjau per URL menampilkan "Siap disimpan" (hijau) atau alasan penolakan (merah), plus ringkasan "x dari y URL siap disimpan".
- **Tandai sudah ditagih**: No. invoice\*, Tgl invoice\*, Nominal\* (default sisa). Bila NOT_READY, tampil banner peringatan dan field alasan wajib.
- **Catat pembayaran**: tgl bayar\*, nominal diterima\*, No. kwitansi.
- **Batalkan MO**: alasan\*.
- **Tambah/Edit klien**: field PRD FR-CL-01 dan peringatan duplikat. Nama dinormalisasi (lowercase, buang PT/CV/Tbk, isi kurung, dan tanda baca), lalu dicocokkan sama persis atau mengandung.

### 7. Klien dan Detail klien (FR-CL-01..03)
- **Daftar**: tabel (Perusahaan, PIC, Email, Telp, Kota, Jumlah MO), pencarian, dan tombol "Tambah klien" (AS).
- **Detail**: card data klien (NIK dimasking kecuali 4 digit terakhir), card histori MO (klik untuk membuka MO), serta tombol Edit klien dan "Buat MO untuk klien" (form terisi dengan klien ini).

### 8. Master data (pratinjau Super Admin)
Tab: Jenis benefit (list + tambah; benefit baru otomatis menjadi kolom Daftar MO), Penandatangan (3 card dengan slot tanda tangan dan stempel), Sales, Pajak & penomoran (rumus + template nomor + nomor berikutnya), dan Profil perusahaan (rekening Mandiri 173.00.2228855.0). Di produksi, halaman ini hanya untuk role SUPER_ADMIN.

### 9. Pratinjau PDF MO (PRD §8)
- **Halaman A4**: 794×1123px pada 96dpi, font dasar 11px.
- **Header** navy `#1c1e54`: "inilah.com" 22px/500, nama PT, dan alamat di kiri; "Media Order" 34px/300 di kanan. Di bawah header ada garis **indigo 4px** (versi Stripi dari garis merah di dokumen acuan).
- **Kotak-kotak** (border hairline, radius 6px), urutannya sama dengan dokumen acuan:
  1. No/Tanggal
  2. Klien dua kolom
  3. Periode/Keterangan
  4. Detail iklan: semua opsi dicetak dengan ☑/☐; Detail kerjasama 4 baris bergaris; T&C bernomor
  5. Pembayaran dan biaya: DPP/PPN hanya bila kena PPN; Total tebal dengan garis ink; kotak "Menyetujui, Tanda Tangan / Stampel Pengiklan"; info rekening
  6. Tanda tangan 3 kolom; jabatan CBO dicetak miring; stempel di kolom "Disetujui oleh"
- **Tanda tangan** hanya dicetak untuk status ≥ SUBMITTED. Draft diberi watermark "DRAFT" (180px, `rgba(13,37,61,0.07)`, rotasi −30°); MO dibatalkan diberi watermark "DIBATALKAN".
- **Nama file**: `MO_{nomor-strip}_{PERUSAHAAN}_{Bulan_Tahun-Bulan_Tahun}.pdf`.
- Di produksi, PDF dirender di backend dengan Puppeteer.

### 10. Notifikasi
Panel dropdown (380px, fixed di kanan atas). Tiap item berisi dot indigo (belum dibaca), judul tnum, sub, dan waktu; klik membuka MO. Ada tombol "Tandai semua dibaca".
- Finance: notifikasi MO siap ditagih.
- Admin Sales: notifikasi H-30 akhir periode dengan pemenuhan < 100%.

## Interactions & Behavior
- **Status turunan**: status dihitung dari data, bukan disimpan manual. Lihat `calc()` di logic class:
  - `DRAFT` / `CANCELLED` tersimpan sebagai `base`.
  - Selain itu: semua benefit penuh → `COMPLETED`; ada realisasi atau lampiran → `ACTIVE`; sisanya `SUBMITTED`.
  - Penagihan: ada tagihan → `PAID` bila total dibayar ≥ total MO, selain itu `BILLED`; tanpa tagihan → `READY_TO_BILL` bila benefit penuh, selain itu `NOT_READY`.
- **Submit**: validasi → nomor `{SEQ:3}/MO-{SALES_CODE}/INC/{ROMAN(bulan tanggal MO)}/{YEAR}` → form terkunci → buka Detail tab Ringkasan dengan toast.
- **Revisi**: MO lama menjadi CANCELLED dengan alasan "Direvisi", lalu draft baru dibuat (`revOf`) dan realisasi ikut dipindahkan. **Duplikat**: draft baru tanpa realisasi atau tagihan, bertanggal hari ini.
- **Validasi realisasi**:
  - Format URL harus valid dan URL tidak boleh ganda dalam satu MO.
  - Input melebihi kuota ditolak, kecuali dicentang bonus. Bonus tidak dihitung melebihi 100%.
  - Tanggal di luar periode hanya diberi peringatan, tidak diblokir.
- Saat pemenuhan mencapai 100%, sistem menampilkan toast dan mengirim notifikasi ke Finance.
- **Toast**: bg `#0d253d`, teks putih, 14px/400, radius 8px, fixed di bawah tengah, hilang otomatis setelah 3,6 detik.
- **Hover dan motion**: baris tabel memakai bg `#f6f9fc`. Button mengikuti `ds_reference/Button.jsx` (primary → `#4434d4`, press → `#2e2b8c`, transisi 120ms `cubic-bezier(0.25,1,0.5,1)`).
- **Ekspor**: CSV (UTF-8 BOM) dan Excel dengan sel angka bertipe Number. Di produksi gunakan ExcelJS di backend.
- **RBAC**: menyembunyikan tombol hanya untuk UX. Semua endpoint wajib dicek di backend (PRD §3, §10).

## State Management
- Entitas: `mos[]`, `clients[]`, `benefitTypes[]`, `sequences{year:lastSeq}`, `notifications[]`, dan user/role.
- Bentuk MO bisa dilihat di `mk()` pada `oplah-data.js`.
- State UI: filter (`dateField, from, to, client, sales, status, billing, fulfil, q`), draft form, error form, tab aktif, modal aktif beserta field-nya, dan panel notifikasi.
- Di produksi, simpan filter di query string. Gunakan TanStack Query untuk `/media-orders`, `/media-orders/:id`, dan `/finance/dashboard`, lalu invalidasi setelah mutasi publikasi atau penagihan.

## Design Tokens
Lihat `tokens/*.css`. Ringkasan:
- **Warna**:
  - ink `#0d253d`, ink-secondary `#273951`, ink-mute `#64748d`
  - primary `#533afd` / deep `#4434d4` / press `#2e2b8c`, subdued `#b9b9f9`
  - brand-dark `#1c1e54`
  - canvas `#fff`, canvas-soft `#f6f9fc`
  - hairline `#e3e8ee`, hairline-input `#a8c3de`
  - ruby `#ea2261`
  - success `#15be53` / bg `#d7f7c2` / text `#05690d`; warning bg `#fcedb9` / text `#a82c00`; danger bg `#ffe7f2` / text `#b3093c`
- **Tipografi**: Inter (pengganti Söhne) 300/400/500, `font-feature-settings: "ss01"` global, dan `"tnum"` + letter-spacing −0.42px untuk angka. Skala: 26 / 22 / 18 / 16 / 15 (body) / 14 / 13 / 12 / 11. Mono: JetBrains Mono.
- **Spacing**: basis 8px (2, 4, 8, 12, 16, 24, 32, 64).
- **Radius**: 4 (tag/chip), 6 (input), 8 (card kecil), 12 (card), 16 (chrome), dan pill 9999 (semua button, Tag, segmented).
- **Shadow**: L1 `rgba(0,55,112,0.08) 0 1px 3px`; L2 `rgba(0,55,112,0.08) 0 8px 24px, rgba(0,55,112,0.04) 0 2px 6px`.
- **Focus ring**: `0 0 0 3px rgba(83,58,253,0.24)`.

## Assets
- Belum ada logo resmi Inilah.com; yang dipakai sekarang logo teks/huruf "i". Ganti dengan logo asli.
- Tanda tangan dan stempel di PDF masih teks pengganti (Söhne Bold Italic dan lingkaran "STEMPEL"). Di produksi gunakan PNG dari master penandatangan.
- Tidak ada ikon atau gambar lain. Bila perlu ikon, gunakan Lucide (stroke 1.75).

## Files
- `Oplah Media Order.dc.html`: seluruh layar (template + class logic `Component`).
- `oplah-data.js`: data seed, konstanta opsi form, helper format, rumus pajak.
- `PRD.md`: spesifikasi produk lengkap (API, skema DB, milestone, acceptance criteria).
- `tokens/`: token warna, tipografi, dan spacing.
- `ds_reference/`: komponen Button, TextInput, Tag, dan GradientMesh dari design system (acuan style dan state).
