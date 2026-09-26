import { expect, test, type Page } from '@playwright/test';

// AC M6: buat klien → buat MO → submit → unduh PDF → input realisasi → Finance tandai BILLED → PAID.
const PASSWORD = process.env.SEED_PASSWORD || 'password123';
const tag = Date.now().toString(36);
const company = `PT E2E ${tag}`;

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test('alur utama Admin Sales → Finance', async ({ page }) => {
  // 1. Admin Sales membuat klien
  await login(page, 'sales@inilah.local');
  await page.goto('/klien');
  await page.getByRole('button', { name: 'Tambah klien' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Perusahaan / Biro Iklan').fill(company);
  await dialog.getByLabel('Nama PIC').fill('Budi E2E');
  await dialog.getByLabel('Email').fill(`e2e-${tag}@example.com`);
  await dialog.getByLabel('No. Telp').fill('08123456789');
  await dialog.getByRole('button', { name: 'Simpan klien' }).click();
  await expect(page).toHaveURL(/\/klien\/[0-9a-f-]{36}$/);

  // 2. Buat MO dari klien lalu submit
  await page.getByRole('link', { name: /Buat MO untuk klien/ }).click();
  await expect(page.getByLabel('Perusahaan / Biro Iklan')).toHaveValue(company);
  await page.getByLabel('Tanggal MO').fill('2026-05-22');
  await page.getByLabel('Masa periode, mulai').fill('2026-06');
  await page.getByLabel('Sampai').fill('2027-05');
  await page.getByLabel('Keterangan').fill('Publikasi Rilis Artikel');
  await page.getByLabel('Kuantitas').fill('12');
  await page.getByLabel('Subtotal').fill('20000000');
  await expect(page.getByText('Rp 22.200.000')).toBeVisible();
  await page.getByRole('button', { name: /Submit MO/ }).click();
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveText(/^\d{3}\/MO-BMO\/INC\/V\/2026$/);
  const moNumber = (await heading.textContent())!;

  // 3. Unduh PDF
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Unduh PDF' }).click();
  expect((await download).suggestedFilename()).toBe(`MO_${moNumber.replaceAll('/', '-')}_PT_E2E_${tag.toUpperCase()}_Juni_2026-Mei_2027.pdf`);

  // 4. Input 12 realisasi (massal) → 100%, Selesai, Siap ditagih
  await page.getByRole('button', { name: 'Input massal' }).click();
  const urls = Array.from({ length: 12 }, (_, i) => `https://www.inilah.com/e2e/${tag}-${i + 1}`);
  await page.getByLabel('URL (satu per baris)').fill(urls.join('\n'));
  await expect(page.getByText('12 dari 12 URL siap disimpan')).toBeVisible();
  await page.getByRole('button', { name: 'Simpan 12 URL' }).click();
  await expect(page.getByText('12/12')).toBeVisible();
  await expect(page.getByText('Selesai', { exact: true })).toBeVisible();
  await expect(page.getByText('Siap ditagih', { exact: true })).toBeVisible();

  // 5. Finance: MO ada di Daftar MO → Penagihan → BILLED → PAID
  await page.locator('aside').getByRole('button', { name: 'Keluar' }).click();
  await login(page, 'finance@inilah.local');
  await page.goto(`/mo?q=${encodeURIComponent(moNumber)}`);
  await page.getByRole('cell', { name: moNumber }).click();
  await expect(page).toHaveURL(/tab=penagihan/);
  await page.getByRole('button', { name: 'Tandai sudah ditagih' }).click();
  await page.getByLabel('No. invoice').fill(`INV-${tag}`);
  await page.getByRole('button', { name: 'Simpan tagihan' }).click();
  await expect(page.getByText('Sudah ditagih', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Catat pembayaran' }).click();
  await page.getByLabel('No. kwitansi').fill(`KW-${tag}`);
  await page.getByRole('button', { name: 'Simpan pembayaran' }).click();
  await expect(page.getByText('Lunas', { exact: true })).toBeVisible();
});
