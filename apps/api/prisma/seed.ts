/** Seed idempoten (DATABASE.md §8): aman dijalankan berulang. */
import { PrismaClient, type FormOptionGroup, type Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import { calculateTax } from '../src/modules/tax/tax.service';

const prisma = new PrismaClient();
const ORG_ID = '00000000-0000-4000-8000-000000000001';
const SIG_ACK_ID = '00000000-0000-4000-8000-000000000011';
const SIG_APPROVE_ID = '00000000-0000-4000-8000-000000000012';
const isDev = process.env.NODE_ENV !== 'production';

const settings = {
  tax: { ppnRate: '12', dppNum: 11, dppDen: 12, rounding: 'HALF_UP' },
  numbering: { template: '{SEQ}/MO-{SALES_CODE}/INC/{MONTH_ROMAN}/{YEAR}', seqPad: 3 },
  requiredClientFields: ['picName', 'companyName', 'email', 'phone'],
  termsTemplates: [
    {
      name: 'Rilis Artikel',
      body: 'Kerjasama ini tidak mencakup penjagaan narasi pemberitaan di Inilah.com, klien hanya membeli inventori rilis artikel.\nWaktu operasional produksi konten pukul 09:00 - 21:00',
    },
  ],
};

const benefitTypes = [
  ['ARTIKEL_RILIS', 'Artikel Rilis', 'Artikel Release'],
  ['INSTAGRAM', 'Instagram', 'Posting Instagram'],
  ['INSTAGRAM_STORY', 'Instagram Story', 'Instagram Story'],
  ['TIKTOK', 'TikTok', 'Video TikTok'],
  ['FACEBOOK', 'Facebook', 'Posting Facebook'],
  ['X', 'X', 'Posting X'],
  ['VIDEOTORIAL_WEBSITE', 'Videotorial Website', 'Videotorial Website'],
] as const;

const formOptions: [FormOptionGroup, string, string, string?][] = [
  ['AD_TYPE', 'BANNER', 'Banner'],
  ['AD_TYPE', 'ADVERTORIAL', 'Advertorial'],
  ['AD_TYPE', 'LIPSUS', 'Lipsus'],
  ['AD_TYPE', 'MIKROSITE', 'Mikrosite'],
  ['AD_TYPE', 'ARTIKEL', 'Artikel'],
  ['AD_TYPE', 'ARTIKEL_BACKLINK', 'Artikel + Backlink'],
  ['AD_TYPE', 'VIDEO', 'Video'],
  ['COOP_TYPE', 'FULL_BARTER', 'Full Barter'],
  ['COOP_TYPE', 'SEMI_BARTER', 'Semi Barter'],
  ['PLACEMENT', 'HALAMAN_DEPAN', 'Halaman Depan'],
  ['PLACEMENT', 'HALAMAN_DETAIL', 'Halaman Detail'],
  ['PLACEMENT', 'HALAMAN_KANAL', 'Halaman Kanal'],
  ['AD_LOCATION', 'SPOT_WEB', 'Spot Ads Website'],
  ['AD_LOCATION', 'BILLBOARD', 'Billboard Uk. 970x250', 'SPOT_WEB'],
  ['AD_LOCATION', 'SINGLE_SKYSCRAPER', 'Single Skyscraper Uk. 160x600', 'SPOT_WEB'],
  ['AD_LOCATION', 'FULL_SKYSCRAPER', 'Full Skyscraper Uk. 2 (160x600)', 'SPOT_WEB'],
  ['AD_LOCATION', 'MEDIUM_RECTANGLE', 'Medium Rectangle Uk. 300x250', 'SPOT_WEB'],
  ['AD_LOCATION', 'LEADERBOARD_ONE', 'Leaderboard One Uk. 728x90', 'SPOT_WEB'],
  ['AD_LOCATION', 'FULL_LEADERBOARD', 'Full Leaderboard Uk. 970x90', 'SPOT_WEB'],
  ['AD_LOCATION', 'BOTTOM_FULL_LEADERBOARD', 'Bottom Full Leaderboard Uk. 970x90', 'SPOT_WEB'],
  ['AD_LOCATION', 'STICKY_FOOTER', 'Sticky Footer Uk.970x90', 'SPOT_WEB'],
  ['AD_LOCATION', 'POPUP', 'Pop-up Uk. Custom', 'SPOT_WEB'],
  ['AD_LOCATION', 'SPOT_MOBILE', 'Spot Ads Mobile'],
];

async function main() {
  const org = {
    name: 'PT. Indonesia News Center',
    address: 'Jl. Rimba No.42, Cipete Utara, Kby. Baru, Kota Jakarta Selatan, DKI Jakarta 12150',
    bankName: 'Bank Mandiri',
    bankAccountNo: '173.00.2228855.0',
    bankAccountName: 'PT. Indonesia News Center',
  };
  await prisma.organization.upsert({ where: { id: ORG_ID }, create: { id: ORG_ID, ...org, settings }, update: org });

  const bimo = await prisma.sales.upsert({
    where: { organizationId_code: { organizationId: ORG_ID, code: 'BMO' } },
    create: { organizationId: ORG_ID, name: 'Bimo', code: 'BMO', email: 'bimo@inilah.com' },
    update: {},
  });

  for (const s of [
    { id: SIG_ACK_ID, name: 'Fitriyanti K', title: 'SPV Marketing & Sales', docRole: 'ACKNOWLEDGED_BY' as const },
    { id: SIG_APPROVE_ID, name: 'Alvin Alverdian', title: 'Chief Business Officer', docRole: 'APPROVED_BY' as const },
  ]) {
    await prisma.signatory.upsert({ where: { id: s.id }, create: { ...s, organizationId: ORG_ID, isDefault: true }, update: {} });
  }

  for (const [i, [code, name, pdfLabel]] of benefitTypes.entries()) {
    await prisma.benefitType.upsert({
      where: { organizationId_code: { organizationId: ORG_ID, code } },
      create: { organizationId: ORG_ID, code, name, pdfLabel, sortOrder: i + 1 },
      update: {},
    });
  }

  for (const [i, [group, code, label, parentCode]] of formOptions.entries()) {
    await prisma.formOption.upsert({
      where: { organizationId_group_code: { organizationId: ORG_ID, group, code } },
      create: { organizationId: ORG_ID, group, code, label, parentCode, sortOrder: i + 1 },
      update: {},
    });
  }

  const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD || 'password123', 12);
  const users: { email: string; name: string; role: Role; salesId?: string }[] = [
    { email: 'superadmin@inilah.local', name: 'Super Admin', role: 'SUPER_ADMIN' },
  ];
  if (isDev) {
    users.push(
      { email: 'sales@inilah.local', name: 'Bimo', role: 'ADMIN_SALES', salesId: bimo.id },
      { email: 'finance@inilah.local', name: 'Rahmawati', role: 'FINANCE' },
      { email: 'viewer@inilah.local', name: 'Manajemen', role: 'VIEWER' },
    );
  }
  for (const u of users) {
    await prisma.user.upsert({
      where: { organizationId_email: { organizationId: ORG_ID, email: u.email } },
      create: { ...u, organizationId: ORG_ID, passwordHash },
      update: {},
    });
  }

  if (isDev) {
    const superadmin = await prisma.user.findUniqueOrThrow({
      where: { organizationId_email: { organizationId: ORG_ID, email: 'superadmin@inilah.local' } },
    });
    const companyName = 'PT Bukit Asam Tbk (PTBA)';
    const snapshot = { companyName, picName: '(isi PIC)', email: 'pic@example.com', phone: '0800000000' };
    const ptba =
      (await prisma.client.findFirst({ where: { organizationId: ORG_ID, companyName } })) ??
      (await prisma.client.create({ data: { organizationId: ORG_ID, ...snapshot, createdBy: superadmin.id } }));

    // MO contoh PRD §14 sebagai Draft (tidak memakai nomor urut).
    if (!(await prisma.mediaOrder.findFirst({ where: { organizationId: ORG_ID, clientId: ptba.id } }))) {
      const artikel = await prisma.benefitType.findUniqueOrThrow({ where: { organizationId_code: { organizationId: ORG_ID, code: 'ARTIKEL_RILIS' } } });
      const tax = calculateTax('20000000', true, settings.tax);
      await prisma.mediaOrder.create({
        data: {
          organizationId: ORG_ID,
          moDate: new Date('2026-05-22'),
          clientId: ptba.id,
          clientSnapshot: { ...snapshot, npwp: null, address: null, city: null, postalCode: null },
          salesId: bimo.id,
          periodStart: new Date('2026-06-01'),
          periodEnd: new Date('2027-05-31'),
          description: 'Publikasi Rilis Artikel',
          selectedOptions: { AD_TYPE: ['ARTIKEL'], COOP_TYPE: [], PLACEMENT: [], AD_LOCATION: [] },
          cooperationDetail: 'Artikel Release (Materi Ready To Post) 12x',
          termsConditions:
            'Kerjasama ini tidak mencakup penjagaan narasi pemberitaan di Inilah.com, PTBA hanya membeli inventori rilis artikel.\nPembayaran pada bulan September 2026 setelah PKS selesai ditandatangan kedua pihak.\nWaktu operasional produksi konten pukul 09:00 - 21:00',
          subtotal: tax.subtotal,
          dppAmount: tax.dpp,
          ppnAmount: tax.ppn,
          totalAmount: tax.total,
          acknowledgedById: SIG_ACK_ID,
          approvedById: SIG_APPROVE_ID,
          createdBy: superadmin.id,
          benefits: { create: [{ benefitTypeId: artikel.id, targetQty: 12, notes: 'Materi Ready To Post' }] },
        },
      });
    }
  }
}

main()
  .then(() => console.info('Seed selesai'))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
