import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  can,
  formatTanggal,
  isHttpUrl,
  normalizeUrl,
  publicationSchema,
  today,
  type BenefitTypeDto,
  type MediaOrderDto,
  type PublicationDto,
  type PublicationInput,
} from '@inc/shared'
import type { z } from 'zod'
import { Field, Notice, selectClass } from '@/components/field'
import { QueryState } from '@/components/query-state'
import { Tag } from '@/components/tag'
import { Button } from '@/components/ui/button'
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
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useCurrentUser } from '@/lib/auth-store'
import { applyServerErrors } from '@/lib/form-errors'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { useMasterList } from '@/features/master-data/api'
import { useBulkPublications, useDeletePublication, usePublications, useSavePublication } from '../api'

type Benefit = MediaOrderDto['benefitProgress'][number]
const MAX_SHOT = 5 * 1024 * 1024
const fail = (e: unknown) => toast(e instanceof Error ? e.message : 'Gagal menyimpan')
const readyToast = (r: { becameReady: boolean }) => r.becameReady && toast('Pemenuhan 100%: MO siap ditagih, Finance mendapat notifikasi.')

/** Tab Realisasi publikasi (FR-PUB-01..07, README desain §5). */
export function PublicationsTab({ mo }: { mo: MediaOrderDto }) {
  const { role } = useCurrentUser()
  const query = usePublications(mo.id)
  const types = useMasterList<BenefitTypeDto>(queryKeys.benefitTypes, '/benefit-types')
  const remove = useDeletePublication()
  const [editing, setEditing] = useState<PublicationDto | 'new' | null>(null)
  const [bulk, setBulk] = useState(false)
  const [deleting, setDeleting] = useState<PublicationDto | null>(null)

  const billed = mo.billingStatus === 'BILLED' || mo.billingStatus === 'PAID'
  const submitted = mo.status !== 'DRAFT' && mo.status !== 'CANCELLED'
  const canEdit = can(role, 'managePublications') && submitted && !billed
  const typeName = (benefitTypeId: string) => types.data?.find((t) => t.id === benefitTypeId)?.name ?? '…'
  const outOfPeriod = (d: string) => d < mo.periodStart || d > mo.periodEnd

  const onDelete = async () => {
    if (!deleting) return
    try {
      await remove.mutateAsync(deleting.id)
      toast('Realisasi dihapus.')
    } catch (e) {
      fail(e)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {!submitted && <Notice tone="warning">Realisasi bisa diinput setelah MO disubmit.</Notice>}
      {submitted && billed && <Notice tone="warning">MO sudah ditagih; realisasi terkunci.</Notice>}
      {submitted && !billed && !can(role, 'managePublications') && (
        <Notice tone="warning">Mode baca: periksa link realisasi untuk verifikasi sebelum menagih.</Notice>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
        {mo.benefitProgress.map((b) => {
          const full = b.realizedQty >= b.targetQty
          const notes = mo.benefits.find((x) => x.benefitTypeId === b.benefitTypeId)?.notes
          return (
            <div key={b.id} className="flex flex-col gap-2 rounded-lg border border-hairline bg-background p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm">{typeName(b.benefitTypeId)}</span>
                <span className="tnum text-sm">
                  {b.realizedQty}/{b.targetQty}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-canvas-soft" role="progressbar" aria-valuenow={b.realizedQty} aria-valuemax={b.targetQty}>
                <div className={cn('h-full rounded-full', full ? 'bg-[#15be53]' : 'bg-primary')} style={{ width: `${Math.min(100, (b.realizedQty / b.targetQty) * 100)}%` }} />
              </div>
              <span className="text-xs text-ink-mute">
                {notes ?? '—'}
                {b.bonusQty > 0 && ` · bonus ${b.bonusQty}`}
              </span>
            </div>
          )
        })}
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setEditing('new')}>
            Tambah realisasi
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setBulk(true)}>
            Input massal
          </Button>
        </div>
      )}

      <QueryState query={query} rows={3} isEmpty={(d) => d.length === 0} empty="Belum ada realisasi publikasi.">
        {(rows) => (
          <div className="overflow-hidden rounded-lg border border-hairline bg-background">
            {rows.map((p) => (
              <div key={p.id} className="grid gap-x-4 gap-y-1 border-b border-hairline px-4 py-3 text-sm last:border-b-0 min-[760px]:grid-cols-[110px_140px_minmax(0,1fr)_auto]">
                <span className="tnum text-ink-mute">{formatTanggal(p.publishedDate)}</span>
                <span>{typeName(p.benefitTypeId)}</span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  {p.title && <span className="truncate">{p.title}</span>}
                  <a href={p.url} target="_blank" rel="noreferrer" className="truncate text-[13px]">
                    {p.url}
                  </a>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {p.isBonus && <Tag tone="soft">Bonus</Tag>}
                    {outOfPeriod(p.publishedDate) && <Tag tone="warning">Di luar periode</Tag>}
                    {p.screenshotUrl && (
                      <a href={p.screenshotUrl} target="_blank" rel="noreferrer" className="text-xs">
                        Bukti screenshot
                      </a>
                    )}
                    {p.notes && <span className="text-xs text-ink-mute">{p.notes}</span>}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-start gap-3">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setDeleting(p)}>
                      Hapus
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </QueryState>

      {editing && (
        <PublicationDialog mo={mo} item={editing === 'new' ? undefined : editing} typeName={typeName} outOfPeriod={outOfPeriod} onClose={() => setEditing(null)} />
      )}
      {bulk && <BulkDialog mo={mo} existing={query.data ?? []} typeName={typeName} outOfPeriod={outOfPeriod} onClose={() => setBulk(false)} />}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus realisasi?</AlertDialogTitle>
            <AlertDialogDescription>{deleting?.url}. Progress benefit dan status MO dihitung ulang.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction size="sm" className="bg-ruby hover:bg-danger-text" disabled={remove.isPending} onClick={onDelete}>
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

type DialogProps = { mo: MediaOrderDto; typeName: (id: string) => string; outOfPeriod: (d: string) => boolean; onClose: () => void }

function BenefitSelect({ benefits, typeName, ...props }: { benefits: Benefit[]; typeName: (id: string) => string } & React.ComponentProps<'select'>) {
  return (
    <select className={selectClass} {...props}>
      {benefits.map((b) => (
        <option key={b.id} value={b.id}>
          {typeName(b.benefitTypeId)} ({b.realizedQty}/{b.targetQty})
        </option>
      ))}
    </select>
  )
}

function PublicationDialog({ mo, item, typeName, outOfPeriod, onClose }: DialogProps & { item?: PublicationDto }) {
  const save = useSavePublication(mo.id)
  const [shot, setShot] = useState<File | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PublicationInput, unknown, z.output<typeof publicationSchema>>({
    resolver: zodResolver(publicationSchema),
    defaultValues: item
      ? { moBenefitId: item.moBenefitId, publishedDate: item.publishedDate, title: item.title ?? '', url: item.url, notes: item.notes ?? '', isBonus: item.isBonus }
      : { moBenefitId: mo.benefitProgress[0]?.id, publishedDate: today(), title: '', url: '', notes: '', isBonus: false },
  })

  const onSubmit = handleSubmit(async (body) => {
    try {
      const res = await save.mutateAsync({ id: item?.id, body, screenshot: shot })
      toast(item ? 'Realisasi diperbarui.' : 'Realisasi ditambahkan.')
      readyToast(res)
      onClose()
    } catch (e) {
      applyServerErrors(e, setError, ['moBenefitId', 'publishedDate', 'title', 'url', 'notes', 'isBonus'])
    }
  })
  const date = watch('publishedDate')

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>{item ? 'Edit realisasi' : 'Tambah realisasi'}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
              <Field id="pub-benefit" label="Jenis benefit" required error={errors.moBenefitId?.message}>
                <BenefitSelect id="pub-benefit" benefits={mo.benefitProgress} typeName={typeName} {...register('moBenefitId')} />
              </Field>
              <Field id="pub-date" label="Tanggal tayang" required error={errors.publishedDate?.message}>
                <Input id="pub-date" type="date" aria-invalid={!!errors.publishedDate} {...register('publishedDate')} />
              </Field>
            </div>
            {date && outOfPeriod(date) && <Notice tone="warning">Tanggal tayang di luar masa periode MO. Tetap bisa disimpan.</Notice>}
            <Field id="pub-title" label="Judul konten" error={errors.title?.message}>
              <Input id="pub-title" {...register('title')} />
            </Field>
            <Field id="pub-url" label="URL publikasi" required error={errors.url?.message}>
              <Input id="pub-url" type="url" inputMode="url" placeholder="https://" aria-invalid={!!errors.url} {...register('url')} />
            </Field>
            <Field id="pub-shot" label="Bukti screenshot" helper={item?.screenshotUrl ? 'Sudah ada; pilih file untuk mengganti.' : 'Opsional, PNG/JPG maks. 5 MB'}>
              <Input
                id="pub-shot"
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  if (f && f.size > MAX_SHOT) {
                    toast('Ukuran screenshot maksimal 5 MB.')
                    e.target.value = ''
                    return setShot(null)
                  }
                  setShot(f)
                }}
              />
            </Field>
            <Field id="pub-notes" label="Catatan" error={errors.notes?.message}>
              <Input id="pub-notes" {...register('notes')} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register('isBonus')} /> Bonus / melebihi kontrak
            </label>
            {errors.isBonus?.message && <Notice tone="danger">{errors.isBonus.message}</Notice>}
          </DialogBody>
          <DialogFooter showCloseButton>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** FR-PUB-02: pratinjau per URL di klien; server memvalidasi ulang dan menolak per URL. */
function BulkDialog({ mo, existing, typeName, outOfPeriod, onClose }: DialogProps & { existing: PublicationDto[] }) {
  const save = useBulkPublications(mo.id)
  const [benefitId, setBenefitId] = useState(mo.benefitProgress[0]?.id ?? '')
  const [date, setDate] = useState(today())
  const [text, setText] = useState('')
  const [bonus, setBonus] = useState(false)

  const benefit = mo.benefitProgress.find((b) => b.id === benefitId)
  let remaining = bonus ? Infinity : (benefit?.targetQty ?? 0) - (benefit?.realizedQty ?? 0)
  const seen = new Set(existing.map((p) => normalizeUrl(p.url)))
  const preview = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((url) => {
      const reason = !isHttpUrl(url) ? 'URL tidak valid' : seen.has(normalizeUrl(url)) ? 'URL sudah tercatat / ganda' : remaining <= 0 ? 'Melebihi kuota benefit' : null
      if (!reason) {
        seen.add(normalizeUrl(url))
        remaining--
      }
      return { url, reason }
    })
  const ready = preview.filter((p) => !p.reason)

  const onSave = async () => {
    try {
      const res = await save.mutateAsync({ moBenefitId: benefitId, publishedDate: date, urls: ready.map((p) => p.url), isBonus: bonus })
      toast(`${res.created} realisasi tersimpan${res.rejected.length ? `, ${res.rejected.length} ditolak` : ''}.`)
      readyToast(res)
      onClose()
    } catch (e) {
      fail(e)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Input massal realisasi</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
            <Field id="bulk-benefit" label="Jenis benefit" required>
              <BenefitSelect id="bulk-benefit" benefits={mo.benefitProgress} typeName={typeName} value={benefitId} onChange={(e) => setBenefitId(e.target.value)} />
            </Field>
            <Field id="bulk-date" label="Tanggal tayang" required>
              <Input id="bulk-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          {date && outOfPeriod(date) && <Notice tone="warning">Tanggal tayang di luar masa periode MO. Tetap bisa disimpan.</Notice>}
          <Field id="bulk-urls" label="URL (satu per baris)" required>
            <Textarea id="bulk-urls" rows={6} className="font-mono text-sm" value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={bonus} onChange={(e) => setBonus(e.target.checked)} /> Bonus / melebihi kontrak
          </label>
          {preview.length > 0 && (
            <div className="flex flex-col gap-1 rounded-md bg-canvas-soft p-3 text-[13px]">
              <span className="text-ink-secondary">
                {ready.length} dari {preview.length} URL siap disimpan
              </span>
              {preview.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <span className={cn('flex-none', p.reason ? 'text-ruby' : 'text-[#05690d]')}>{p.reason ?? 'Siap disimpan'}</span>
                  <span className="truncate font-mono text-ink-mute">{p.url}</span>
                </div>
              ))}
            </div>
          )}
        </DialogBody>
        <DialogFooter showCloseButton>
          <Button size="sm" disabled={!ready.length || save.isPending} onClick={onSave}>
            {save.isPending ? 'Menyimpan…' : `Simpan ${ready.length} URL`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
