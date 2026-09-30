import { useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  can,
  formatPeriode,
  formatRupiah,
  formatTanggal,
  formOptionGroup,
  formOptionGroupLabel,
  type BenefitTypeDto,
  type FormOptionDto,
  type MediaOrderDto,
} from '@inc/shared'
import { Notice } from '@/components/field'
import { MoStatusTags } from '@/components/mo-status'
import { QueryState } from '@/components/query-state'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import { downloadFile } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/lib/auth-store'
import { queryKeys } from '@/lib/query-keys'
import { useMasterList } from '@/features/master-data/api'
import { BillingTab } from '@/features/finance/BillingTab'
import { useHistory } from '@/features/finance/api'
import { PublicationsTab } from '../components/PublicationsTab'
import { useDeleteMo, useMediaOrder, useMoAction, useRegeneratePdf, useUploadAttachment, type MoAction } from '../api'

type Confirm = 'delete' | 'revise' | 'cancel' | null
type Tab = 'realisasi' | 'ringkasan' | 'penagihan' | 'lampiran'
const TABS: [Tab, string][] = [
  ['realisasi', 'Realisasi publikasi'],
  ['ringkasan', 'Ringkasan MO'],
  ['penagihan', 'Penagihan'],
  ['lampiran', 'Lampiran & riwayat'],
]
const fail = (e: unknown) => toast(e instanceof Error ? e.message : 'Gagal memproses')

/** Detail MO (README desain §5): tab dari `?tab=` agar bisa ditautkan (Finance langsung ke Penagihan). */
export function MoDetailPage() {
  const id = useParams().id!
  const query = useMediaOrder(id)
  return (
    <div className="flex flex-col gap-5">
      <QueryState query={query} rows={6}>
        {(mo) => <MoDetail mo={mo} />}
      </QueryState>
    </div>
  )
}

function MoDetail({ mo }: { mo: MediaOrderDto }) {
  const { role } = useCurrentUser()
  const navigate = useNavigate()
  const action = useMoAction()
  const remove = useDeleteMo()
  const regenerate = useRegeneratePdf()
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find(([k]) => k === params.get('tab'))?.[0] ?? (mo.status === 'DRAFT' ? 'ringkasan' : 'realisasi')) as Tab
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true })
  const [reason, setReason] = useState('')

  const isDraft = mo.status === 'DRAFT'
  const open = mo.status === 'SUBMITTED' || mo.status === 'ACTIVE'
  const billed = mo.billingStatus === 'BILLED' || mo.billingStatus === 'PAID'

  const run = async (act: MoAction, done: (r: MediaOrderDto) => void, body?: unknown) => {
    try {
      done(await action.mutateAsync({ id: mo.id, action: act, body }))
    } catch (e) {
      fail(e)
    } finally {
      setConfirm(null)
    }
  }
  const onDelete = async () => {
    try {
      await remove.mutateAsync(mo.id)
      toast('Draft dihapus.')
      navigate(`/klien/${mo.clientId}`, { replace: true })
    } catch (e) {
      fail(e)
    }
  }

  return (
    <>
      <Link to={`/klien/${mo.clientId}`} className="w-fit text-sm">
        ← {mo.clientSnapshot.companyName ?? 'Klien'}
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="tnum text-[26px] leading-[1.12] font-light tracking-[-0.26px]">{mo.moNumber ?? 'Draft'}</h1>
            <MoStatusTags status={mo.status} billingStatus={mo.billingStatus} />
          </div>
          <span className="text-sm text-ink-mute">
            {mo.clientSnapshot.companyName}
            {isDraft && ' · Nomor MO digenerate saat submit'}
          </span>
          {mo.revisionOf && (
            <span className="text-sm text-ink-mute">
              Revisi dari <Link to={`/mo/${mo.revisionOf.id}`}>{mo.revisionOf.moNumber}</Link>
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {can(role, 'editMo') && isDraft && (
            <>
              <Button variant="destructive" size="sm" onClick={() => setConfirm('delete')}>
                Hapus draft
              </Button>
              <Link to={`/mo/${mo.id}/edit`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                Lanjutkan edit
              </Link>
            </>
          )}
          {can(role, 'cancelMo') && open && (
            <Button variant="destructive" size="sm" onClick={() => setConfirm('cancel')}>
              Batalkan MO
            </Button>
          )}
          {can(role, 'editMo') && open && !billed && (
            <Button variant="secondary" size="sm" onClick={() => setConfirm('revise')}>
              Revisi
            </Button>
          )}
          {can(role, 'editMo') && (
            <Button
              variant="secondary"
              size="sm"
              disabled={action.isPending}
              onClick={() =>
                run('duplicate', (d) => {
                  toast('Duplikat dibuat sebagai draft baru.')
                  navigate(`/mo/${d.id}/edit`)
                })
              }
            >
              Duplikat
            </Button>
          )}
          {can(role, 'regenerateMoPdf') && !isDraft && (
            <Button
              variant="ghost"
              size="sm"
              disabled={regenerate.isPending}
              onClick={() => regenerate.mutateAsync(mo.id).then(() => toast('PDF final dibuat ulang.'), fail)}
            >
              Generate ulang PDF
            </Button>
          )}
          {can(role, 'downloadMoPdf') && (
            <Button size="sm" onClick={() => downloadFile(`/media-orders/${mo.id}/pdf`).catch(fail)}>
              Unduh PDF
            </Button>
          )}
        </div>
      </div>

      {mo.status === 'CANCELLED' && (
        <Notice tone="danger">
          MO dibatalkan. Alasan: {mo.cancelReason}
          {mo.revisedInto && (
            <>
              {' · '}Revisi: <Link to={`/mo/${mo.revisedInto.id}`}>{mo.revisedInto.moNumber ?? 'Draft revisi'}</Link>
            </>
          )}
        </Notice>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] overflow-hidden rounded-lg border border-hairline bg-background">
        {[
          ['Total payment', `Rp ${formatRupiah(mo.totalAmount)}`],
          ['Masa periode', formatPeriode(mo.periodStart, mo.periodEnd)],
          ['Sales', `${mo.sales.name} (${mo.sales.code})`],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col gap-1 border-hairline px-5 py-4 not-first:border-l">
            <span className="text-xs text-ink-mute">{k}</span>
            <span className="tnum text-base">{v}</span>
          </div>
        ))}
        <div className="flex flex-col gap-1.5 border-l border-hairline px-5 py-4">
          <span className="text-xs text-ink-mute">Pemenuhan</span>
          <span className="tnum text-base">{Number(mo.fulfillmentPct).toLocaleString('id-ID')}%</span>
          <div className="h-1.5 overflow-hidden rounded-full bg-canvas-soft">
            <div className={cn('h-full rounded-full', Number(mo.fulfillmentPct) >= 100 ? 'bg-[#15be53]' : 'bg-primary')} style={{ width: `${Math.min(100, Number(mo.fulfillmentPct))}%` }} />
          </div>
        </div>
      </div>

      <nav className="flex gap-5 overflow-x-auto border-b border-hairline" aria-label="Tab detail MO">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-current={tab === key ? 'page' : undefined}
            className={cn('-mb-px border-b-2 py-2.5 text-sm whitespace-nowrap', tab === key ? 'border-primary text-primary' : 'border-transparent text-ink-mute hover:text-ink')}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === 'realisasi' && <PublicationsTab mo={mo} />}
      {tab === 'ringkasan' && <Summary mo={mo} />}
      {tab === 'penagihan' && <BillingTab mo={mo} />}
      {tab === 'lampiran' && (
        <>
          <Attachments mo={mo} />
          <History moId={mo.id} />
        </>
      )}

      <AlertDialog open={confirm === 'delete'} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus draft MO?</AlertDialogTitle>
            <AlertDialogDescription>Draft dihapus permanen. MO yang sudah disubmit tidak bisa dihapus.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction size="sm" className="bg-ruby hover:bg-danger-text" disabled={remove.isPending} onClick={onDelete}>
              Hapus draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === 'revise'} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revisi MO {mo.moNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              MO ini dibatalkan dengan alasan "Direvisi" dan draft salinan dibuat untuk diedit. Realisasi publikasi ikut dipindahkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              size="sm"
              disabled={action.isPending}
              onClick={() =>
                run('revise', (d) => {
                  toast(`${mo.moNumber} dibatalkan (Direvisi). Lanjutkan edit draft revisi.`)
                  navigate(`/mo/${d.id}/edit`)
                })
              }
            >
              Buat revisi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === 'cancel'} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan MO {mo.moNumber}?</AlertDialogTitle>
            <AlertDialogDescription>MO yang dibatalkan tidak dapat diaktifkan kembali dan nomornya tidak dipakai ulang.</AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex flex-col gap-1.5 text-sm text-ink-secondary">
            Alasan pembatalan *
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel>Kembali</AlertDialogCancel>
            <AlertDialogAction
              size="sm"
              className="bg-ruby hover:bg-danger-text"
              disabled={!reason.trim() || action.isPending}
              onClick={() => run('cancel', () => toast('MO dibatalkan.'), { reason })}
            >
              Batalkan MO
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function Card({ title, rows }: { title: string; rows: [string, React.ReactNode][] }) {
  return (
    <section className="flex flex-col rounded-lg border border-hairline bg-background px-6 py-5">
      <h2 className="mb-2 text-base font-normal">{title}</h2>
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 border-t border-hairline py-2.5 text-sm">
          <span className="text-ink-mute">{k}</span>
          <span className="break-words whitespace-pre-line">{v || '—'}</span>
        </div>
      ))}
    </section>
  )
}

function Summary({ mo }: { mo: MediaOrderDto }) {
  const options = useMasterList<FormOptionDto>(queryKeys.formOptions, '/form-options')
  const types = useMasterList<BenefitTypeDto>(queryKeys.benefitTypes, '/benefit-types')
  const c = mo.clientSnapshot
  const label = (code: string) => options.data?.find((o) => o.code === code)?.label ?? code
  const s = mo.signatories

  return (
    <div className="grid items-start gap-4 min-[980px]:grid-cols-2">
      <Card
        title="Data klien"
        rows={[
          ['Nama (PIC)', c.picName],
          ['Perusahaan', c.companyName],
          ['NPWP', c.npwp],
          ['Alamat', c.address],
          ['Kota', c.city],
          ['Kode Pos', c.postalCode],
          ['Email', c.email],
          ['No. Telp', c.phone],
        ]}
      />
      <Card
        title="Periode & detail iklan"
        rows={[
          ['Masa periode', formatPeriode(mo.periodStart, mo.periodEnd)],
          ['Keterangan', mo.description],
          ['Tanggal tayang', mo.airingDateText],
          ...formOptionGroup.map((g): [string, string] => [formOptionGroupLabel[g], mo.selectedOptions[g].map(label).join(', ')]),
          ['Benefit', mo.benefits.map((b) => `${types.data?.find((t) => t.id === b.benefitTypeId)?.name ?? '…'} × ${b.targetQty}${b.notes ? ` (${b.notes})` : ''}`).join('\n')],
          ['Detail kerjasama', mo.cooperationDetail],
          ['Term & conditions', mo.termsConditions],
        ]}
      />
      <Card
        title="Pembayaran"
        rows={[
          ['Cara pembayaran', !mo.paymentMethod ? null : mo.paymentMethod === 'TRANSFER' ? 'Transfer' : `Cek/BG ${mo.chequeNo ?? ''}`],
          ['Kwitansi No', mo.receiptNo],
          ['Jatuh tempo', mo.dueDateText],
          ['Produk iklan', mo.adProduct],
          ['Subtotal', `Rp ${formatRupiah(mo.subtotal)}`],
          ...(mo.isTaxable
            ? ([
                [`DPP ${mo.dppFactorNum}/${mo.dppFactorDen}`, `Rp ${formatRupiah(mo.dppAmount)}`],
                [`PPN ${mo.ppnRate}%`, `Rp ${formatRupiah(mo.ppnAmount)}`],
              ] as [string, string][])
            : [['PPN', 'Tidak kena PPN'] as [string, string]]),
          ['Total payment', <b key="t">Rp {formatRupiah(mo.totalAmount)}</b>],
        ]}
      />
      <Card
        title="Penandatangan"
        rows={[
          ['Dibuat oleh', s.createdBy && `${s.createdBy.name} · ${s.createdBy.title}`],
          ['Diketahui oleh', s.acknowledgedBy && `${s.acknowledgedBy.name} · ${s.acknowledgedBy.title}`],
          ['Disetujui oleh', s.approvedBy && `${s.approvedBy.name} · ${s.approvedBy.title}`],
        ]}
      />
    </div>
  )
}

/** FR-MO-12: dokumen MO bertanda tangan klien (PDF/JPG/PNG, maks 10 MB, bisa banyak). */
function Attachments({ mo }: { mo: MediaOrderDto }) {
  const { role } = useCurrentUser()
  const upload = useUploadAttachment(mo.id)
  const input = useRef<HTMLInputElement>(null)
  const canUpload = can(role, 'editMo') && mo.status !== 'DRAFT' && mo.status !== 'CANCELLED'

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    for (const f of files) {
      if (f.size > 10 * 1024 * 1024) {
        toast(`${f.name}: ukuran maksimal 10 MB.`)
        continue
      }
      try {
        await upload.mutateAsync(f)
        toast(`${f.name} terunggah.`)
      } catch (err) {
        fail(err)
      }
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-hairline bg-background px-6 py-5">
      <h2 className="text-base font-normal">
        Lampiran <span className="text-sm font-light text-ink-mute">{mo.attachments.length}</span>
      </h2>
      {mo.attachments.length === 0 && <span className="text-sm text-ink-mute">Belum ada dokumen MO bertanda tangan klien.</span>}
      {mo.attachments.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-2.5 text-sm">
          {a.url ? (
            <a href={a.url} target="_blank" rel="noreferrer">
              {a.fileName}
            </a>
          ) : (
            <span>{a.fileName}</span>
          )}
          <span className="text-ink-mute">
            {(a.sizeBytes / 1024 / 1024).toFixed(1)} MB · {formatTanggal(a.createdAt)}
          </span>
        </div>
      ))}
      {canUpload && (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-hairline-input p-5 text-center text-sm text-ink-mute">
          <span>MO bertanda tangan klien · PDF, JPG, PNG · maks. 10 MB</span>
          <input ref={input} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className="hidden" onChange={onFiles} />
          <Button variant="secondary" size="sm" disabled={upload.isPending} onClick={() => input.current?.click()}>
            {upload.isPending ? 'Mengunggah…' : 'Pilih file'}
          </Button>
          {mo.status === 'SUBMITTED' && <span className="text-xs">Unggahan pertama mengubah status MO menjadi Berjalan.</span>}
        </div>
      )}
    </section>
  )
}

/** Riwayat perubahan dari audit_logs (FR-AUD-01). */
function History({ moId }: { moId: string }) {
  const query = useHistory(moId)
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-hairline bg-background px-6 py-5">
      <h2 className="text-base font-normal">Riwayat</h2>
      <QueryState query={query} rows={3} isEmpty={(d) => d.length === 0} empty="Belum ada riwayat.">
        {(rows) => (
          <ol className="flex flex-col">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 border-t border-hairline py-2.5 text-sm">
                <span>
                  {r.action}
                  {r.summary && <span className="text-ink-mute"> · {r.summary}</span>}
                </span>
                <span className="text-[13px] text-ink-mute">
                  {r.userName ?? 'Sistem'} · {new Date(r.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' })}
                </span>
              </li>
            ))}
          </ol>
        )}
      </QueryState>
    </section>
  )
}
