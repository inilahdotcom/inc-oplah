import { useState } from 'react'
import { toast } from 'sonner'
import { can, formatRupiah, formatTanggal, today, type BillingDto, type MediaOrderDto } from '@inc/shared'
import { Field, Notice } from '@/components/field'
import { RupiahInput } from '@/components/rupiah-input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api-client'
import { useCurrentUser } from '@/lib/auth-store'
import { useCreateBilling, usePayBilling } from './api'

const sum = (xs: (string | null)[]) => xs.reduce((s, x) => s + BigInt(x ?? 0), 0n).toString()
const errorsOf = (e: unknown) => (e instanceof ApiError ? Object.fromEntries(e.details.map((d) => [d.field, d.message])) : {})

/** Tab Penagihan (FR-FIN-05, README desain §5). Nominal dijumlahkan dengan BigInt, bukan float. */
export function BillingTab({ mo }: { mo: MediaOrderDto }) {
  const { role } = useCurrentUser()
  const [billing, setBilling] = useState(false)
  const [paying, setPaying] = useState<BillingDto | null>(null)
  const billed = sum(mo.billings.map((b) => b.amount))
  const paid = sum(mo.billings.map((b) => b.paidAmount))
  const remaining = (BigInt(mo.totalAmount) - BigInt(billed)).toString()
  const outstanding = (BigInt(mo.totalAmount) - BigInt(paid)).toString()
  const canBill = can(role, 'manageBilling') && mo.status !== 'DRAFT' && mo.status !== 'CANCELLED'

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] overflow-hidden rounded-lg border border-hairline bg-background">
        {[
          ['Total MO', mo.totalAmount],
          ['Sudah ditagih', billed],
          ['Diterima', paid],
          ['Sisa belum dibayar', outstanding],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col gap-1 border-hairline px-5 py-4 not-first:border-l">
            <span className="text-xs text-ink-mute">{k}</span>
            <span className="tnum text-base">Rp {formatRupiah(v)}</span>
          </div>
        ))}
      </div>

      {mo.billingStatus === 'NOT_READY' && mo.status !== 'DRAFT' && mo.status !== 'CANCELLED' && (
        <Notice tone="warning">Benefit belum terpenuhi 100%. Menagih sekarang tetap bisa, dengan alasan yang dicatat.</Notice>
      )}
      {canBill && BigInt(remaining) > 0n && (
        <div>
          <Button size="sm" onClick={() => setBilling(true)}>
            Tandai sudah ditagih
          </Button>
        </div>
      )}

      {mo.billings.length === 0 ? (
        <span className="text-sm text-ink-mute">Belum ada tagihan.</span>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-hairline bg-background">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>No. invoice</TableHead>
                <TableHead>Tgl invoice</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
                <TableHead>Tgl bayar</TableHead>
                <TableHead className="text-right">Diterima</TableHead>
                <TableHead>Kwitansi</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {mo.billings.map((b) => (
                <TableRow key={b.id} className="hover:bg-transparent">
                  <TableCell className="text-ink">
                    {b.invoiceNo}
                    {b.overrideReason && <span className="block text-xs text-warning-text">Ditagih sebelum 100%: {b.overrideReason}</span>}
                  </TableCell>
                  <TableCell className="tnum">{formatTanggal(b.invoiceDate)}</TableCell>
                  <TableCell className="tnum text-right">{formatRupiah(b.amount)}</TableCell>
                  <TableCell className="tnum">{b.paidDate ? formatTanggal(b.paidDate) : '—'}</TableCell>
                  <TableCell className="tnum text-right">{b.paidAmount ? formatRupiah(b.paidAmount) : '—'}</TableCell>
                  <TableCell>{b.receiptNo ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    {can(role, 'manageBilling') && (
                      <Button variant="ghost" size="sm" onClick={() => setPaying(b)}>
                        {b.paidDate ? 'Ubah pembayaran' : 'Catat pembayaran'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {billing && <BillDialog mo={mo} remaining={remaining} onClose={() => setBilling(false)} />}
      {paying && <PayDialog billing={paying} onClose={() => setPaying(null)} />}
    </div>
  )
}

function BillDialog({ mo, remaining, onClose }: { mo: MediaOrderDto; remaining: string; onClose: () => void }) {
  const create = useCreateBilling(mo.id)
  const override = mo.billingStatus === 'NOT_READY'
  const [v, setV] = useState({ invoiceNo: '', invoiceDate: today(), amount: remaining, overrideReason: '' })
  const [err, setErr] = useState<Record<string, string>>({})

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await create.mutateAsync({ ...v, overrideReason: override ? v.overrideReason : undefined })
      toast('Tagihan tercatat.')
      onClose()
    } catch (ex) {
      setErr(errorsOf(ex))
      if (!(ex instanceof ApiError && ex.details.length)) toast(ex instanceof Error ? ex.message : 'Gagal menyimpan')
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>Tandai sudah ditagih · {mo.moNumber}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {override && <Notice tone="warning">Benefit belum terpenuhi 100% ({Number(mo.fulfillmentPct).toLocaleString('id-ID')}%). Alasan wajib diisi dan Super Admin diberi tahu.</Notice>}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
              <Field id="bill-no" label="No. invoice" required error={err.invoiceNo}>
                <Input id="bill-no" value={v.invoiceNo} onChange={(e) => setV({ ...v, invoiceNo: e.target.value })} aria-invalid={!!err.invoiceNo} />
              </Field>
              <Field id="bill-date" label="Tgl invoice" required error={err.invoiceDate}>
                <Input id="bill-date" type="date" value={v.invoiceDate} onChange={(e) => setV({ ...v, invoiceDate: e.target.value })} />
              </Field>
            </div>
            <Field id="bill-amount" label="Nominal ditagih" required error={err.amount} helper={`Sisa belum ditagih Rp ${formatRupiah(remaining)}`}>
              <RupiahInput id="bill-amount" value={v.amount} onChange={(amount) => setV({ ...v, amount })} aria-invalid={!!err.amount} />
            </Field>
            {override && (
              <Field id="bill-reason" label="Alasan menagih sebelum 100%" required error={err.overrideReason}>
                <Textarea id="bill-reason" rows={3} value={v.overrideReason} onChange={(e) => setV({ ...v, overrideReason: e.target.value })} aria-invalid={!!err.overrideReason} />
              </Field>
            )}
          </DialogBody>
          <DialogFooter showCloseButton>
            <Button type="submit" size="sm" disabled={create.isPending}>
              {create.isPending ? 'Menyimpan…' : 'Simpan tagihan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PayDialog({ billing, onClose }: { billing: BillingDto; onClose: () => void }) {
  const pay = usePayBilling()
  const [v, setV] = useState({ paidDate: billing.paidDate ?? today(), paidAmount: billing.paidAmount ?? billing.amount, receiptNo: billing.receiptNo ?? '' })
  const [err, setErr] = useState<Record<string, string>>({})

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await pay.mutateAsync({ id: billing.id, body: v })
      toast('Pembayaran tercatat.')
      onClose()
    } catch (ex) {
      setErr(errorsOf(ex))
      if (!(ex instanceof ApiError && ex.details.length)) toast(ex instanceof Error ? ex.message : 'Gagal menyimpan')
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>Catat pembayaran · {billing.invoiceNo}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
              <Field id="pay-date" label="Tgl bayar" required error={err.paidDate}>
                <Input id="pay-date" type="date" value={v.paidDate} onChange={(e) => setV({ ...v, paidDate: e.target.value })} />
              </Field>
              <Field id="pay-receipt" label="No. kwitansi" error={err.receiptNo}>
                <Input id="pay-receipt" value={v.receiptNo} onChange={(e) => setV({ ...v, receiptNo: e.target.value })} />
              </Field>
            </div>
            <Field id="pay-amount" label="Nominal diterima" required error={err.paidAmount} helper={`Nominal tagihan Rp ${formatRupiah(billing.amount)}`}>
              <RupiahInput id="pay-amount" value={v.paidAmount} onChange={(paidAmount) => setV({ ...v, paidAmount })} aria-invalid={!!err.paidAmount} />
            </Field>
          </DialogBody>
          <DialogFooter showCloseButton>
            <Button type="submit" size="sm" disabled={pay.isPending}>
              {pay.isPending ? 'Menyimpan…' : 'Simpan pembayaran'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
