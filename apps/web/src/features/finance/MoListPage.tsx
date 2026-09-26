import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  billingStatus,
  billingStatusLabel,
  can,
  formatPeriodeSingkat,
  formatRupiah,
  formatTanggal,
  moStatus,
  moStatusLabel,
  type BenefitTypeDto,
  type ClientListItem,
  type MoListRow,
  type Paginated,
  type SalesDto,
} from '@inc/shared'
import { selectClass } from '@/components/field'
import { MoStatusTags } from '@/components/mo-status'
import { QueryState } from '@/components/query-state'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, downloadFile } from '@/lib/api-client'
import { useCurrentUser } from '@/lib/auth-store'
import { queryKeys } from '@/lib/query-keys'
import { useDebounce } from '@/lib/use-debounce'
import { cn } from '@/lib/utils'
import { useMasterList } from '@/features/master-data/api'
import { useMoList } from './api'

const chip = (b: { targetQty: number; realizedQty: number } | undefined) =>
  !b ? null : b.realizedQty >= b.targetQty ? 'bg-success-bg text-success-text' : b.realizedQty > 0 ? 'bg-warning-bg text-warning-text' : 'bg-canvas-soft text-ink-mute'

/** Daftar Media Order (FR-FIN-01..06, README desain §3). Filter disimpan di URL. */
export function MoListPage() {
  const { role } = useCurrentUser()
  const navigate = useNavigate()
  const [search, setSearch] = useSearchParams()
  const params = Object.fromEntries(search)
  const query = useMoList(params)
  const types = useMasterList<BenefitTypeDto>(queryKeys.benefitTypes, '/benefit-types')
  const sales = useMasterList<SalesDto>(queryKeys.sales, '/sales')
  const clients = useQuery({ queryKey: ['clients', 'options'], queryFn: () => api<Paginated<ClientListItem>>('/clients?limit=100').then((r) => r.data) })
  const benefitCols = (types.data ?? []).filter((t) => t.isActive)

  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(search)
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    if (!('page' in patch)) next.delete('page')
    setSearch(next, { replace: true })
  }
  const [q, setQ] = useState(params.q ?? '')
  const dq = useDebounce(q.trim(), 300)
  useEffect(() => {
    if ((search.get('q') ?? '') !== dq) set({ q: dq || undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sinkron hanya saat teks pencarian berubah
  }, [dq])

  const exportFile = (format: 'xlsx' | 'csv') => {
    const qs = new URLSearchParams(search)
    qs.delete('page')
    qs.set('format', format)
    void downloadFile(`/finance/media-orders/export?${qs}`)
  }
  const counts = query.data?.billingCounts
  // Finance langsung ke tab Penagihan (desain §3).
  const moHref = (id: string) => `/mo/${id}${role === 'FINANCE' ? '?tab=penagihan' : ''}`
  const page = Number(params.page ?? 1)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] leading-[1.12] font-light tracking-[-0.26px]">Daftar Media Order</h1>
          <span className="text-sm text-ink-mute">{query.data ? `${query.data.total} MO sesuai filter` : ' '}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {can(role, 'export') && (
            <>
              <Button variant="secondary" size="sm" onClick={() => exportFile('csv')}>
                Ekspor CSV
              </Button>
              <Button variant="secondary" size="sm" onClick={() => exportFile('xlsx')}>
                Ekspor Excel
              </Button>
            </>
          )}
          {can(role, 'editMo') && (
            <Link to="/mo/baru" className={buttonVariants({ size: 'sm' })}>
              Buat MO
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Status penagihan">
        {([undefined, ...billingStatus] as const).map((s) => (
          <button
            key={s ?? 'all'}
            type="button"
            onClick={() => set({ billingStatus: s })}
            className={cn(
              'rounded-full border px-3 py-1.5 text-[13px]',
              (params.billingStatus ?? undefined) === s ? 'border-[1.5px] border-primary text-primary' : 'border-hairline bg-background text-ink-secondary',
            )}
          >
            {s ? billingStatusLabel[s] : 'Semua'}{' '}
            <span className="tnum text-ink-mute">{counts ? (s ? counts[s] : Object.values(counts).reduce((a, b) => a + b, 0)) : ''}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl bg-canvas-soft p-4">
        <div className="flex rounded-full border border-hairline bg-background p-0.5" role="group" aria-label="Jenis tanggal">
          {(
            [
              ['mo_date', 'Tanggal MO'],
              ['period', 'Periode tayang'],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => set({ dateField: v === 'mo_date' ? undefined : v })}
              className={cn('rounded-full px-3 py-1.5 text-[13px]', (params.dateField ?? 'mo_date') === v ? 'bg-primary text-white' : 'text-ink-secondary')}
            >
              {l}
            </button>
          ))}
        </div>
        <FilterField label="Dari">
          <Input type="month" value={params.from ?? ''} onChange={(e) => set({ from: e.target.value })} className="w-40" />
        </FilterField>
        <FilterField label="Sampai">
          <Input type="month" value={params.to ?? ''} onChange={(e) => set({ to: e.target.value })} className="w-40" />
        </FilterField>
        <FilterSelect label="Perusahaan" value={params.clientId} onChange={(v) => set({ clientId: v })} options={(clients.data ?? []).map((c) => [c.id, c.companyName])} />
        <FilterSelect label="Sales" value={params.salesId} onChange={(v) => set({ salesId: v })} options={(sales.data ?? []).map((s) => [s.id, s.name])} />
        <FilterSelect label="Status MO" value={params.status} onChange={(v) => set({ status: v })} options={moStatus.map((s) => [s, moStatusLabel[s]])} />
        <FilterSelect
          label="Pemenuhan"
          value={params.fulfillment}
          onChange={(v) => set({ fulfillment: v })}
          options={[
            ['none', 'Belum'],
            ['partial', 'Sebagian'],
            ['full', 'Terpenuhi'],
          ]}
        />
        <FilterField label="Cari">
          <Input type="search" placeholder="Nomor MO, perusahaan, sales" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
        </FilterField>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2.5"
          onClick={() => {
            setQ('')
            setSearch(new URLSearchParams(), { replace: true })
          }}
        >
          Reset
        </Button>
      </div>

      <QueryState query={query} rows={6} isEmpty={(d) => d.data.length === 0} empty="Tidak ada MO sesuai filter.">
        {(d) => (
          <>
            <div className="overflow-x-auto rounded-lg border border-hairline bg-background">
              <Table className="min-w-[1560px] tracking-[-0.42px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Nomor MO</TableHead>
                    <TableHead>Tanggal MO</TableHead>
                    <TableHead>Periode Tayang</TableHead>
                    <TableHead>Perusahaan / Instansi</TableHead>
                    <TableHead>Nama Sales</TableHead>
                    <TableHead className="text-right">Sebelum PPN</TableHead>
                    <TableHead className="text-right">PPN</TableHead>
                    <TableHead className="text-right">Setelah PPN</TableHead>
                    {benefitCols.map((t) => (
                      <TableHead key={t.id} className="text-center">
                        {t.name}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">% Pemenuhan</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.data.map((m: MoListRow) => (
                    <TableRow key={m.id} className="cursor-pointer" onClick={() => navigate(moHref(m.id))}>
                      <TableCell className="tnum whitespace-nowrap text-ink">
                        <Link to={moHref(m.id)} onClick={(e) => e.stopPropagation()} className="text-ink hover:text-ink focus-visible:underline">
                          {m.moNumber ?? 'Draft'}
                        </Link>
                      </TableCell>
                      <TableCell className="tnum whitespace-nowrap">{formatTanggal(m.moDate)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatPeriodeSingkat(m.periodStart, m.periodEnd)}</TableCell>
                      <TableCell>{m.companyName}</TableCell>
                      <TableCell>{m.salesName}</TableCell>
                      <TableCell className="tnum text-right">{formatRupiah(m.subtotal)}</TableCell>
                      <TableCell className="tnum text-right">{formatRupiah(m.ppnAmount)}</TableCell>
                      <TableCell className="tnum text-right text-ink">{formatRupiah(m.totalAmount)}</TableCell>
                      {benefitCols.map((t) => {
                        const b = m.benefits[t.id]
                        return (
                          <TableCell key={t.id} className="text-center">
                            {b ? <span className={cn('tnum rounded px-1.5 py-0.5 text-[13px]', chip(b))}>{`${b.realizedQty}/${b.targetQty}`}</span> : '—'}
                          </TableCell>
                        )
                      })}
                      <TableCell className="tnum text-right">{Number(m.fulfillmentPct).toLocaleString('id-ID')}%</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <MoStatusTags status={m.status} billingStatus={m.billingStatus} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="text-ink-mute">
                      Total (tanpa MO dibatalkan)
                    </TableCell>
                    <TableCell className="tnum text-right text-ink">{formatRupiah(d.totals.subtotal)}</TableCell>
                    <TableCell className="tnum text-right text-ink">{formatRupiah(d.totals.ppnAmount)}</TableCell>
                    <TableCell className="tnum text-right text-ink">{formatRupiah(d.totals.totalAmount)}</TableCell>
                    <TableCell colSpan={benefitCols.length + 2} />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-mute">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded bg-success-bg px-1.5 text-success-text">terpenuhi</span>
                <span className="rounded bg-warning-bg px-1.5 text-warning-text">sebagian</span>
                <span className="rounded bg-canvas-soft px-1.5">belum ada realisasi</span>
                <span>— benefit tidak ada di MO</span>
              </div>
              {d.total > d.limit && (
                <div className="flex items-center gap-2">
                  <span className="tnum">
                    {(page - 1) * d.limit + 1}–{Math.min(page * d.limit, d.total)} dari {d.total}
                  </span>
                  <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })}>
                    Sebelumnya
                  </Button>
                  <Button variant="secondary" size="sm" disabled={page * d.limit >= d.total} onClick={() => set({ page: String(page + 1) })}>
                    Berikutnya
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </QueryState>
    </div>
  )
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-mute">
      {label}
      {children}
    </label>
  )
}

function FilterSelect({ label, value, onChange, options }: { label: string; value?: string; onChange: (v?: string) => void; options: (readonly [string, string])[] }) {
  return (
    <FilterField label={label}>
      <select className={cn(selectClass, 'w-auto min-w-36')} value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">Semua</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </FilterField>
  )
}
