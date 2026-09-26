import { Link } from 'react-router-dom'
import { formatRupiah, formatTanggal, today } from '@inc/shared'
import { PageHeader } from '@/components/page-header'
import { QueryState } from '@/components/query-state'
import { useDashboard } from './api'

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
/** "45000000" → "45 jt" (label batang). */
const singkat = (v: string) => {
  const n = Number(v)
  return n >= 1e9 ? `${(n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M` : n >= 1e6 ? `${Math.round(n / 1e6)} jt` : n ? formatRupiah(v) : ''
}

/** Dashboard Finance (FR-FIN-07, README desain §2). Grafik batang cukup CSS. */
export function DashboardPage() {
  const year = Number(today().slice(0, 4))
  const query = useDashboard(year)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow="Finance" title="Dashboard" />
      <QueryState query={query} rows={4}>
        {(d) => {
          const max = Math.max(1, ...d.months.map((m) => Number(m.total)))
          return (
            <>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
                <Kpi label={`MO terbit ${d.year}`} value={String(d.moCount)} sub="tanpa draft & dibatalkan" />
                <Kpi label={`Nilai kontrak ${d.year}`} value={`Rp ${formatRupiah(d.contractValue)}`} sub="setelah PPN" />
                <Kpi label="Siap ditagih" value={String(d.readyCount)} sub="Buka daftar →" to="/mo?billingStatus=READY_TO_BILL" />
                <Kpi label="Piutang" value={`Rp ${formatRupiah(d.receivable)}`} sub="ditagih, belum lunas →" to="/mo?billingStatus=BILLED" />
              </div>

              <section className="flex flex-col gap-3 rounded-xl border border-hairline bg-background p-6">
                <h2 className="text-base font-normal">Nilai MO per bulan · {d.year}</h2>
                <div className="grid grid-cols-12 items-end gap-2 overflow-x-auto" style={{ minWidth: 520 }}>
                  {d.months.map((m) => (
                    <div key={m.month} className="flex flex-col items-center gap-1">
                      <span className="tnum text-[11px] text-ink-mute">{singkat(m.total)}</span>
                      <div className="flex h-[200px] w-full items-end">
                        <div
                          className="w-full rounded-t bg-primary"
                          style={{ height: `${(Number(m.total) / max) * 100}%` }}
                          title={`${BULAN[m.month - 1]}: Rp ${formatRupiah(m.total)} (${m.count} MO)`}
                        />
                      </div>
                      <span className="text-xs">{BULAN[m.month - 1]}</span>
                      <span className="tnum text-[11px] text-ink-mute">{m.count} MO</span>
                    </div>
                  ))}
                </div>
              </section>

              <div className="grid items-start gap-4 min-[980px]:grid-cols-2">
                <ListCard
                  title="Siap ditagih"
                  empty="Tidak ada MO yang menunggu ditagih."
                  rows={d.ready.map((m) => ({ id: m.id, no: m.moNumber, company: m.companyName, right: `Rp ${formatRupiah(m.totalAmount)}` }))}
                />
                <ListCard
                  title="Periode berakhir ≤ 30 hari, belum terpenuhi"
                  empty="Tidak ada."
                  rows={d.ending.map((m) => ({
                    id: m.id,
                    no: m.moNumber,
                    company: `${m.companyName ?? ''} · s.d. ${formatTanggal(m.periodEnd)}`,
                    right: `${Number(m.fulfillmentPct).toLocaleString('id-ID')}%`,
                  }))}
                />
              </div>
            </>
          )
        }}
      </QueryState>
    </div>
  )
}

function Kpi({ label, value, sub, to }: { label: string; value: string; sub: string; to?: string }) {
  const body = (
    <>
      <span className="text-[13px] text-ink-mute">{label}</span>
      <span className="tnum text-[26px] leading-tight font-light text-ink">{value}</span>
      <span className="text-[13px] text-ink-mute">{sub}</span>
    </>
  )
  const cls = 'flex flex-col gap-1 rounded-xl border border-hairline bg-background p-5 shadow-l1'
  return to ? (
    <Link to={to} className={`${cls} hover:border-primary hover:text-ink`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

function ListCard({ title, rows, empty }: { title: string; empty: string; rows: { id: string; no: string | null; company: string | null; right: string }[] }) {
  return (
    <section className="flex flex-col rounded-xl border border-hairline bg-background px-6 py-5">
      <h2 className="mb-2 text-base font-normal">{title}</h2>
      {rows.length === 0 && <span className="text-sm text-ink-mute">{empty}</span>}
      {rows.map((r) => (
        <Link key={r.id} to={`/mo/${r.id}`} className="flex items-center justify-between gap-3 border-t border-hairline py-2.5 text-sm text-ink hover:bg-canvas-soft hover:text-ink">
          <span className="flex min-w-0 flex-col">
            <span className="tnum">{r.no}</span>
            <span className="truncate text-[13px] text-ink-mute">{r.company}</span>
          </span>
          <span className="tnum flex-none">{r.right}</span>
        </Link>
      ))}
    </section>
  )
}
