import { useEffect, useState } from 'react'
import { Controller, get, useFieldArray, useForm, type Path } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { UseQueryResult } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import {
  formatMoNumber,
  formatRupiah,
  formOptionGroupLabel,
  monthRange,
  today,
  type BenefitTypeDto,
  type ClientDto,
  type FormOptionDto,
  type FormOptionGroup,
  type MediaOrderDto,
  type MoDraftInput,
  type PaymentMethod,
  type SalesDto,
  type SettingsDto,
  type SignatoryDto,
} from '@inc/shared'
import { Field, Notice, selectClass } from '@/components/field'
import { PageHeader } from '@/components/page-header'
import { QueryState } from '@/components/query-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ApiError, downloadFile } from '@/lib/api-client'
import { useCurrentUser } from '@/lib/auth-store'
import { queryKeys } from '@/lib/query-keys'
import { useDebounce } from '@/lib/use-debounce'
import { cn } from '@/lib/utils'
import { useClient, useClients } from '@/features/clients/api'
import { ClientFormDialog } from '@/features/clients/components/ClientFormDialog'
import { useMasterList, useSettings } from '@/features/master-data/api'
import { useCalculate, useMediaOrder, useMoAction, useSaveMo } from '../api'

const SNAPSHOT = ['picName', 'companyName', 'nik', 'address', 'city', 'postalCode', 'email', 'phone'] as const
type Snapshot = Record<(typeof SNAPSHOT)[number], string>
interface Values {
  moDate: string
  clientId: string
  salesId: string
  clientSnapshot: Snapshot
  startMonth: string
  endMonth: string
  description: string
  airingDateText: string
  selectedOptions: Record<FormOptionGroup, string[]>
  benefits: { benefitTypeId: string; targetQty: number; notes: string }[]
  cooperationDetail: string
  termsConditions: string
  paymentMethod: PaymentMethod
  chequeNo: string
  receiptNo: string
  dueDateText: string
  adProduct: string
  subtotal: string
  isTaxable: boolean
  acknowledgedById: string
  approvedById: string
}
interface Master {
  settings: SettingsDto
  sales: SalesDto[]
  signatories: SignatoryDto[]
  benefitTypes: BenefitTypeDto[]
  options: FormOptionDto[]
}

const s = (v: string | null | undefined) => v ?? ''
const lineCount = (v: string) => (v ? v.split('\n').length : 0)

const fromMo = (mo: MediaOrderDto): Values => ({
  moDate: mo.moDate,
  clientId: mo.clientId,
  salesId: mo.salesId,
  clientSnapshot: Object.fromEntries(SNAPSHOT.map((k) => [k, s(mo.clientSnapshot[k])])) as Snapshot,
  startMonth: mo.periodStart.slice(0, 7),
  endMonth: mo.periodEnd.slice(0, 7),
  description: s(mo.description),
  airingDateText: s(mo.airingDateText),
  selectedOptions: mo.selectedOptions,
  benefits: mo.benefits.map((b) => ({ benefitTypeId: b.benefitTypeId, targetQty: b.targetQty, notes: s(b.notes) })),
  cooperationDetail: s(mo.cooperationDetail),
  termsConditions: s(mo.termsConditions),
  paymentMethod: mo.paymentMethod,
  chequeNo: s(mo.chequeNo),
  receiptNo: s(mo.receiptNo),
  dueDateText: s(mo.dueDateText),
  adProduct: s(mo.adProduct),
  subtotal: mo.subtotal === '0' ? '' : mo.subtotal,
  isTaxable: mo.isTaxable,
  acknowledgedById: s(mo.acknowledgedById),
  approvedById: s(mo.approvedById),
})

const toBody = ({ startMonth, endMonth, ...v }: Values): MoDraftInput => ({
  ...v,
  periodStart: startMonth && monthRange(startMonth)[0],
  periodEnd: endMonth && monthRange(endMonth)[1],
  subtotal: v.subtotal || '0',
  chequeNo: v.paymentMethod === 'CHEQUE_BG' ? v.chequeNo : '',
  acknowledgedById: v.acknowledgedById || null,
  approvedById: v.approvedById || null,
})

/** "Artikel Release (Materi Ready To Post) 12x" per benefit (FR-MO-05). */
const autoDetail = (rows: Values['benefits'], types: BenefitTypeDto[]) =>
  rows
    .map((r) => {
      const t = types.find((x) => x.id === r.benefitTypeId)
      return t ? `${t.pdfLabel ?? t.name}${r.notes.trim() ? ` (${r.notes.trim()})` : ''} ${r.targetQty || 0}x` : ''
    })
    .filter(Boolean)
    .join('\n')

// Nama field server → nama field form.
const ALIAS: Record<string, string> = { periodStart: 'startMonth', periodEnd: 'endMonth' }

/** Buat MO (`/mo/baru?client=…`) & edit draft (`/mo/:id/edit`). README desain §5. */
export function MoFormPage() {
  const { id } = useParams()
  const mo = useMediaOrder(id)
  const settings = useSettings()
  const sales = useMasterList<SalesDto>(queryKeys.sales, '/sales')
  const signatories = useMasterList<SignatoryDto>(queryKeys.signatories, '/signatories')
  const benefitTypes = useMasterList<BenefitTypeDto>(queryKeys.benefitTypes, '/benefit-types')
  const options = useMasterList<FormOptionDto>(queryKeys.formOptions, '/form-options')

  const queries: UseQueryResult<unknown>[] = [settings, sales, signatories, benefitTypes, options, ...(id ? [mo] : [])]
  const blocking = queries.find((q) => q.isError) ?? queries.find((q) => q.isPending)
  if (blocking) return <QueryState query={blocking}>{() => null}</QueryState>

  if (mo.data && mo.data.status !== 'DRAFT') {
    return (
      <div className="flex flex-col items-start gap-4">
        <PageHeader title={`MO ${mo.data.moNumber} sudah disubmit`} />
        <p className="text-sm text-ink-mute">MO yang sudah disubmit tidak bisa diedit. Koreksi lewat Revisi di halaman detail.</p>
        <Link to={`/mo/${mo.data.id}`}>← Detail MO</Link>
      </div>
    )
  }

  return (
    <MoForm
      key={id ?? 'baru'}
      mo={mo.data}
      master={{ settings: settings.data!, sales: sales.data!, signatories: signatories.data!, benefitTypes: benefitTypes.data!, options: options.data! }}
    />
  )
}

function MoForm({ mo, master }: { mo?: MediaOrderDto; master: Master }) {
  const me = useCurrentUser()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const save = useSaveMo()
  const action = useMoAction()
  const { settings, sales, signatories, benefitTypes, options } = master
  const activeTypes = benefitTypes.filter((b) => b.isActive)
  const defaultSigner = (role: SignatoryDto['docRole']) => signatories.find((x) => x.docRole === role && x.isDefault && x.isActive)?.id ?? ''

  const {
    register,
    control,
    watch,
    setValue,
    getValues,
    setError,
    clearErrors,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    defaultValues: mo
      ? fromMo(mo)
      : {
          moDate: today(),
          clientId: '',
          salesId: me.salesId ?? sales.find((x) => x.isActive)?.id ?? '',
          clientSnapshot: Object.fromEntries(SNAPSHOT.map((k) => [k, ''])) as Snapshot,
          startMonth: '',
          endMonth: '',
          description: '',
          airingDateText: '',
          selectedOptions: { AD_TYPE: [], COOP_TYPE: [], PLACEMENT: [], AD_LOCATION: [] },
          benefits: activeTypes[0] ? [{ benefitTypeId: activeTypes[0].id, targetQty: 1, notes: '' }] : [],
          cooperationDetail: '',
          termsConditions: '',
          paymentMethod: 'TRANSFER',
          chequeNo: '',
          receiptNo: '',
          dueDateText: '',
          adProduct: '',
          subtotal: '',
          isTaxable: true,
          acknowledgedById: defaultSigner('ACKNOWLEDGED_BY'),
          approvedById: defaultSigner('APPROVED_BY'),
        },
  })
  const benefits = useFieldArray({ control, name: 'benefits' })
  const [savedId, setSavedId] = useState(mo?.id)
  const [errList, setErrList] = useState<string[]>([])
  const err = (name: string) => (get(errors, name) as { message?: string } | undefined)?.message

  // ── Klien: cari tersimpan (datalist) atau tambah baru → isi snapshot.
  const [clientText, setClientText] = useState(mo?.clientSnapshot.companyName ?? '')
  const [addingClient, setAddingClient] = useState(false)
  const clientQ = useDebounce(clientText.trim(), 300)
  const clients = useClients({ q: clientQ || undefined, page: 1 })
  const pick = (c: ClientDto) => {
    setValue('clientId', c.id)
    SNAPSHOT.forEach((k) => setValue(`clientSnapshot.${k}`, s(c[k])))
    setClientText(c.companyName)
    clearErrors(['clientId', 'clientSnapshot'])
  }
  const prefill = useClient(mo ? '' : (params.get('client') ?? ''))
  useEffect(() => {
    if (prefill.data && !getValues('clientId')) pick(prefill.data)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sekali saat data klien dari ?client= tiba
  }, [prefill.data])

  // ── Detail kerjasama otomatis dari benefit sampai diedit manual (FR-MO-05).
  const rows = watch('benefits')
  const auto = autoDetail(rows, benefitTypes)
  const [manual, setManual] = useState(() => !!mo?.cooperationDetail && mo.cooperationDetail !== autoDetail(fromMo(mo).benefits, benefitTypes))
  useEffect(() => {
    if (!manual) setValue('cooperationDetail', auto)
  }, [auto, manual, setValue])

  // ── Opsi checkbox; anak (Spot Ads Website) hanya aktif bila induk dicentang.
  const selected = watch('selectedOptions')
  const toggle = (group: FormOptionGroup, code: string) => {
    const cur = getValues(`selectedOptions.${group}`)
    let next = cur.includes(code) ? cur.filter((c) => c !== code) : group === 'COOP_TYPE' ? [code] : [...cur, code]
    if (!next.includes(code)) {
      const kids = options.filter((o) => o.group === group && o.parentCode === code).map((o) => o.code)
      next = next.filter((c) => !kids.includes(c))
    }
    setValue(`selectedOptions.${group}`, next)
  }
  const visible = (group: FormOptionGroup, parentCode: string | null) =>
    options.filter((o) => o.group === group && o.parentCode === parentCode && (o.isActive || selected[group].includes(o.code)))
  const optionGroup = (group: FormOptionGroup) => (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-ink-secondary">
        {formOptionGroupLabel[group]}
        {group === 'COOP_TYPE' && <span className="text-ink-mute"> (pilih satu, boleh kosong)</span>}
      </span>
      <div className="flex flex-col gap-2">
        {visible(group, null).map((root) => {
          const kids = visible(group, root.code)
          const on = selected[group].includes(root.code)
          return (
            <div key={root.code} className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={on} onChange={() => toggle(group, root.code)} /> {root.label}
              </label>
              {kids.length > 0 && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2 pl-6">
                  {kids.map((k) => (
                    <label key={k.code} className={cn('flex items-center gap-2 text-sm', !on && 'text-ink-mute')}>
                      <input type="checkbox" disabled={!on} checked={selected[group].includes(k.code)} onChange={() => toggle(group, k.code)} /> {k.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  // ── Ringkasan biaya (dihitung backend) & pratinjau nomor.
  const tax = useCalculate(watch('subtotal'), watch('isTaxable'))
  const moDate = watch('moDate')
  const salesCode = sales.find((x) => x.id === watch('salesId'))?.code
  const nextNo =
    salesCode && moDate?.startsWith(String(settings.nextSeq.year))
      ? formatMoNumber(settings.numbering.template, { seq: settings.nextSeq.seq, pad: settings.numbering.seqPad, salesCode, moDate })
      : '—'
  const [tnc, setTnc] = useState(0)
  const paymentMethod = watch('paymentMethod')

  // ── Simpan / submit. Validasi lengkap hanya saat submit, di server (FR-MO-07).
  const showErrors = (e: unknown) => {
    if (e instanceof ApiError && e.details.length) {
      e.details.forEach((d) => setError((ALIAS[d.field] ?? d.field) as Path<Values>, { message: d.message }))
      setErrList(e.details.map((d) => d.message))
      toast(`Periksa ${e.details.length} isian yang belum valid`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else toast(e instanceof Error ? e.message : 'Gagal menyimpan')
  }
  const persist = async (v: Values) => {
    clearErrors()
    setErrList([])
    const saved = await save.mutateAsync({ id: savedId, body: toBody(v) })
    setSavedId(saved.id)
    return saved
  }
  const onDraft = handleSubmit(async (v) => {
    try {
      const saved = await persist(v)
      toast('Draft tersimpan')
      navigate(`/mo/${saved.id}`)
    } catch (e) {
      showErrors(e)
    }
  })
  const onSubmitMo = handleSubmit(async (v) => {
    try {
      const saved = await persist(v)
      const done = await action.mutateAsync({ id: saved.id, action: 'submit' })
      toast(`MO ${done.moNumber} berhasil disubmit`)
      navigate(`/mo/${saved.id}`, { replace: true })
    } catch (e) {
      showErrors(e)
    }
  })
  const onPreview = () => {
    const tab = window.open('', '_blank') // dibuka saat klik agar tidak diblokir popup blocker
    void handleSubmit(async (v) => {
      try {
        const saved = await persist(v)
        await downloadFile(`/media-orders/${saved.id}/pdf`, tab)
      } catch (e) {
        tab?.close()
        showErrors(e)
      }
    })()
  }

  const text = (name: Path<Values>, label: string, opts: { required?: boolean; placeholder?: string; type?: string; inputMode?: 'numeric' | 'email' | 'tel' } = {}) => (
    <Field id={`mo-${name}`} label={label} required={opts.required} error={err(name)}>
      <Input
        id={`mo-${name}`}
        type={opts.type ?? 'text'}
        inputMode={opts.inputMode}
        placeholder={opts.placeholder}
        aria-invalid={!!err(name)}
        aria-describedby={err(name) ? `mo-${name}-message` : undefined}
        {...register(name)}
      />
    </Field>
  )
  const busy = isSubmitting || save.isPending || action.isPending
  const detail = watch('cooperationDetail')
  const terms = watch('termsConditions')

  return (
    <form onSubmit={onSubmitMo} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Link to={mo ? `/mo/${mo.id}` : '/mo'} className="w-fit text-sm">
          ← {mo ? 'Detail MO' : 'Daftar MO'}
        </Link>
        <PageHeader title={mo ? 'Edit draft Media Order' : 'Buat Media Order'} />
        {mo?.revisionOf && (
          <span className="text-sm text-ink-mute">Revisi dari {mo.revisionOf.moNumber}. MO lama sudah dibatalkan dengan alasan "Direvisi".</span>
        )}
      </div>
      {errList.length > 0 && (
        <Notice tone="danger">
          {errList.length} isian perlu diperbaiki: {errList.join(' · ')}
        </Notice>
      )}

      <div className="grid items-start gap-5 min-[1200px]:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Section letter="A" title="Header">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm text-ink-secondary">No. Media Order</span>
                <div className="flex min-h-10 items-center rounded-sm border border-dashed border-hairline-input px-3 text-[15px] text-ink-mute">(otomatis)</div>
              </div>
              {text('moDate', 'Tanggal MO', { required: true, type: 'date' })}
            </div>
          </Section>

          <Section letter="B" title="Data klien" hint="Disimpan sebagai snapshot saat submit">
            <div className="flex flex-wrap items-end gap-2">
              <Field id="mo-client" label="Klien tersimpan" required error={err('clientId')} className="min-w-[240px] flex-1">
                <Input
                  id="mo-client"
                  list="mo-client-list"
                  placeholder="Cari nama perusahaan…"
                  value={clientText}
                  aria-invalid={!!err('clientId')}
                  onChange={(e) => {
                    setClientText(e.target.value)
                    const c = clients.data?.data.find((x) => x.companyName === e.target.value)
                    if (c) pick(c)
                  }}
                />
              </Field>
              <datalist id="mo-client-list">
                {clients.data?.data.map((c) => (
                  <option key={c.id} value={c.companyName}>
                    {c.picName}
                  </option>
                ))}
              </datalist>
              <Button type="button" variant="secondary" size="sm" className="mb-1" onClick={() => setAddingClient(true)}>
                Tambah klien baru
              </Button>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3.5">
              {text('clientSnapshot.picName', 'Nama (PIC)', { required: true })}
              {text('clientSnapshot.companyName', 'Perusahaan / Biro Iklan', { required: true })}
              {text('clientSnapshot.nik', 'Nomor NIK', { inputMode: 'numeric', placeholder: '16 digit' })}
              {text('clientSnapshot.address', 'Alamat')}
              {text('clientSnapshot.city', 'Kota')}
              {text('clientSnapshot.postalCode', 'Kode Pos', { inputMode: 'numeric' })}
              {text('clientSnapshot.email', 'Email', { required: true, type: 'email', inputMode: 'email' })}
              {text('clientSnapshot.phone', 'No. Telp', { required: true, type: 'tel', inputMode: 'tel' })}
            </div>
          </Section>

          <Section letter="C" title="Periode">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
              {text('startMonth', 'Masa periode, mulai', { required: true, type: 'month' })}
              {text('endMonth', 'Sampai', { required: true, type: 'month' })}
              {text('description', 'Keterangan', { required: true, placeholder: 'Publikasi Rilis Artikel' })}
            </div>
          </Section>

          <Section letter="D" title="Detail iklan">
            {text('airingDateText', 'Tanggal tayang', { placeholder: 'Sesuai jadwal' })}
            {optionGroup('AD_TYPE')}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5">
              {optionGroup('COOP_TYPE')}
              {optionGroup('PLACEMENT')}
            </div>
            <div className="rounded-lg bg-canvas-soft p-4">{optionGroup('AD_LOCATION')}</div>

            <div className="flex flex-col gap-2">
              <span className="text-sm text-ink-secondary">
                Benefit * <span className="text-ink-mute">(min. 1)</span>
              </span>
              {err('benefits') && <span className="text-[13px] text-ruby">{err('benefits')}</span>}
              {benefits.fields.map((f, i) => (
                <div key={f.id} className="grid grid-cols-[minmax(160px,2fr)_90px_minmax(140px,2fr)_auto] items-start gap-2 max-[640px]:grid-cols-[1fr_80px]">
                  <div className="flex flex-col gap-1">
                    <select className={selectClass} aria-label="Jenis benefit" aria-invalid={!!err(`benefits.${i}.benefitTypeId`)} {...register(`benefits.${i}.benefitTypeId`)}>
                      {benefitTypes
                        .filter((b) => b.isActive || b.id === rows[i]?.benefitTypeId)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                    </select>
                    {err(`benefits.${i}.benefitTypeId`) && <span className="text-[13px] text-ruby">{err(`benefits.${i}.benefitTypeId`)}</span>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Input type="number" min={1} inputMode="numeric" aria-label="Kuantitas" aria-invalid={!!err(`benefits.${i}.targetQty`)} {...register(`benefits.${i}.targetQty`, { valueAsNumber: true })} />
                    {err(`benefits.${i}.targetQty`) && <span className="text-[13px] text-ruby">{err(`benefits.${i}.targetQty`)}</span>}
                  </div>
                  <Input placeholder="Catatan (opsional)" aria-label="Catatan" className="max-[640px]:col-span-2" {...register(`benefits.${i}.notes`)} />
                  <Button type="button" variant="destructive" size="sm" className="mt-2.5" disabled={benefits.fields.length <= 1} onClick={() => benefits.remove(i)}>
                    Hapus
                  </Button>
                </div>
              ))}
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const next = activeTypes.find((t) => !rows.some((r) => r.benefitTypeId === t.id)) ?? activeTypes[0]
                    if (next) benefits.append({ benefitTypeId: next.id, targetQty: 1, notes: '' })
                  }}
                >
                  + Tambah benefit
                </Button>
              </div>
            </div>

            <Field id="mo-cooperationDetail" label="Detail kerjasama" required error={err('cooperationDetail')}>
              <div className="flex flex-wrap justify-between gap-2 text-[13px] text-ink-mute">
                <span>
                  Maks. 4 baris ({lineCount(detail)}/4) · {manual ? 'Diedit manual' : 'Terisi otomatis dari benefit'}
                </span>
                {manual && (
                  <button type="button" className="text-primary" onClick={() => setManual(false)}>
                    Isi ulang dari benefit
                  </button>
                )}
              </div>
              <Textarea
                id="mo-cooperationDetail"
                rows={4}
                aria-invalid={!!err('cooperationDetail')}
                {...register('cooperationDetail', { onChange: () => setManual(true) })}
              />
            </Field>

            <Field id="mo-termsConditions" label={`Term and conditions (${lineCount(terms)}/10 baris)`} error={err('termsConditions')}>
              {settings.termsTemplates.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <select className={cn(selectClass, 'w-auto')} aria-label="Template T&C" value={tnc} onChange={(e) => setTnc(Number(e.target.value))}>
                    {settings.termsTemplates.map((t, i) => (
                      <option key={t.name} value={i}>
                        Template: {t.name}
                      </option>
                    ))}
                  </select>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setValue('termsConditions', settings.termsTemplates[tnc].body)}>
                    Pakai template
                  </Button>
                </div>
              )}
              <Textarea id="mo-termsConditions" rows={6} aria-invalid={!!err('termsConditions')} {...register('termsConditions')} />
            </Field>
          </Section>

          <Section letter="E" title="Pembayaran">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
              <Field id="mo-paymentMethod" label="Cara pembayaran" required>
                <select id="mo-paymentMethod" className={selectClass} {...register('paymentMethod')}>
                  <option value="TRANSFER">Transfer</option>
                  <option value="CHEQUE_BG">Cek/BG</option>
                </select>
              </Field>
              {paymentMethod === 'CHEQUE_BG' && text('chequeNo', 'Cek/BG No', { required: true })}
              {text('receiptNo', 'Kwitansi No')}
              {text('dueDateText', 'Jatuh tempo pembayaran', { placeholder: 'September 2026' })}
              {text('adProduct', 'Produk iklan')}
              <Field id="mo-subtotal" label="Subtotal" required error={err('subtotal')}>
                <Controller
                  control={control}
                  name="subtotal"
                  render={({ field }) => (
                    <div className="relative">
                      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[15px] text-ink-mute">Rp</span>
                      <Input
                        id="mo-subtotal"
                        inputMode="numeric"
                        className="tnum pl-10"
                        placeholder="20.000.000"
                        aria-invalid={!!err('subtotal')}
                        value={field.value ? formatRupiah(field.value) : ''}
                        onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 15))}
                        onBlur={field.onBlur}
                      />
                    </div>
                  )}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register('isTaxable')} /> Kena PPN
              <span className="text-[13px] text-ink-mute">Jika nonaktif, PPN = 0 dan baris DPP &amp; PPN tidak dicetak di PDF</span>
            </label>
          </Section>

          <Section letter="F" title="Penandatangan">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
              <Field id="mo-salesId" label="Dibuat oleh" required error={err('salesId')}>
                <select id="mo-salesId" className={selectClass} {...register('salesId')}>
                  <option value="">— Pilih sales —</option>
                  {sales
                    .filter((x) => x.isActive || x.id === mo?.salesId)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name} ({x.title})
                      </option>
                    ))}
                </select>
              </Field>
              {(['ACKNOWLEDGED_BY', 'APPROVED_BY'] as const).map((role) => {
                const name = role === 'ACKNOWLEDGED_BY' ? 'acknowledgedById' : 'approvedById'
                return (
                  <Field key={role} id={`mo-${name}`} label={role === 'ACKNOWLEDGED_BY' ? 'Diketahui oleh' : 'Disetujui oleh'} error={err(name)}>
                    <select id={`mo-${name}`} className={selectClass} {...register(name)}>
                      <option value="">— Kosong —</option>
                      {signatories
                        .filter((x) => x.docRole === role && (x.isActive || x.id === mo?.[name]))
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name} · {x.title}
                          </option>
                        ))}
                    </select>
                  </Field>
                )
              })}
            </div>
          </Section>
        </div>

        <aside className="flex flex-col gap-3 min-[1200px]:sticky min-[1200px]:top-[76px]">
          <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-background p-5 shadow-l2">
            <span className="text-sm text-ink-secondary">Biaya pemasangan</span>
            <Money label="Subtotal" value={tax.data?.subtotal} />
            {watch('isTaxable') && (
              <>
                <Money label={`DPP ${settings.tax.dppNum}/${settings.tax.dppDen}`} value={tax.data?.dpp} />
                <Money label={`PPN ${settings.tax.ppnRate}% (+)`} value={tax.data?.ppn} />
              </>
            )}
            <div className="flex items-baseline justify-between gap-3 border-t border-hairline pt-2">
              <span className="text-sm">Total payment</span>
              <span className="tnum text-[22px] font-light">Rp {tax.data ? formatRupiah(tax.data.total) : '—'}</span>
            </div>
            <span className="text-xs text-ink-mute">Pratinjau. Nilai final dihitung ulang di server saat simpan.</span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl border border-hairline bg-background p-5">
            <span className="text-xs text-ink-mute">Nomor MO bila disubmit sekarang</span>
            <span className="tnum text-sm">{nextNo}</span>
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? 'Memproses…' : 'Submit MO'} <ChevronRight strokeWidth={2.25} />
          </Button>
          <Button type="button" variant="secondary" className="w-full" disabled={busy} onClick={onDraft}>
            Simpan draft
          </Button>
          <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={onPreview}>
            Pratinjau PDF (draft)
          </Button>
        </aside>
      </div>

      <ClientFormDialog open={addingClient} onOpenChange={setAddingClient} onSaved={pick} />
    </form>
  )
}

function Section({ letter, title, hint, children }: { letter: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-hairline bg-background p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2.5">
          <span className="text-xs text-primary">{letter}</span>
          <h2 className="text-lg font-light">{title}</h2>
        </div>
        {hint && <span className="text-[13px] text-ink-mute">{hint}</span>}
      </div>
      {children}
    </section>
  )
}

function Money({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-ink-mute">{label}</span>
      <span className="tnum">Rp {value ? formatRupiah(value) : '—'}</span>
    </div>
  )
}
