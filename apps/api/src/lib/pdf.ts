import puppeteer, { type Browser } from 'puppeteer';
import { logger } from './logger';

// Satu browser Chromium dipakai ulang (ARCHITECTURE §4.5).
// ponytail: tanpa batas halaman bersamaan; tambahkan semaphore (maks 3) bila render menumpuk di produksi.
let browser: Promise<Browser> | null = null;

const launch = () =>
  puppeteer
    .launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined, args: ['--no-sandbox', '--font-render-hinting=none'] })
    .then((b) => {
      b.on('disconnected', () => (browser = null));
      return b;
    })
    .catch((err) => {
      browser = null;
      logger.error({ err }, 'Chromium gagal dijalankan');
      throw err;
    });

/** HTML → PDF A4 (ukuran & margin diatur `@page` di template). */
export async function renderPdf(html: string): Promise<Buffer> {
  browser ??= launch();
  const page = await (await browser).newPage();
  try {
    await page.setContent(html, { waitUntil: 'load' });
    return Buffer.from(await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true }));
  } finally {
    await page.close();
  }
}
