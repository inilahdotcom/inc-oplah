import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { formatBulan, formatRupiah, formatTanggal, maskNik } from '@inc/shared'
import { MoStatusTags } from '@/components/mo-status'
import { QueryState } from '@/components/query-state'
import { RoleGate } from '@/components/role-gate'
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
import { useClient, useDeleteClient } from '../api'
import { ClientFormDialog } from '../components/ClientFormDialog'

export function ClientDetailPage() {
  const id = useParams().id!
  const navigate = useNavigate()
  const query = useClient(id)
  const remove = useDeleteClient()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const onDelete = async () => {
    try {
      await remove.mutateAsync(id)
      toast('Klien dihapus.')
      navigate('/klien', { replace: true })
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menghapus klien')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Link to="/klien" className="w-fit text-sm">
        ← Klien
      </Link>
      <QueryState query={query} rows={4}>
        {(c) => (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h1 className="text-[26px] leading-[1.12] font-light tracking-[-0.26px]">{c.companyName}</h1>
              <RoleGate permission="manageClients">
                <div className="flex flex-wrap gap-2">
                  <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                    Hapus
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                    Edit klien
                  </Button>
                  <Link to={`/mo/baru?client=${c.id}`} className={buttonVariants({ size: 'sm' })}>
                    Buat MO untuk klien <ChevronRight strokeWidth={2.25} />
                  </Link>
                </div>
              </RoleGate>
            </div>

            <div className="grid items-start gap-4 min-[980px]:grid-cols-[minmax(300px,1fr)_minmax(0,2fr)]">
              <section className="flex flex-col rounded-lg border border-hairline bg-background px-6 py-5">
                <h2 className="mb-2 text-base font-normal">Data klien</h2>
                {(
                  [
                    ['PIC', c.picName],
                    ['Email', c.email],
                    ['No. Telp', c.phone],
                    ['NIK', c.nik && maskNik(c.nik)],
                    ['NPWP', c.npwp],
                    ['Alamat', c.address],
                    ['Kota', c.city],
                    ['Kode Pos', c.postalCode],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 border-t border-hairline py-2.5 text-sm">
                    <span className="text-ink-mute">{k}</span>
                    <span className="break-words">{v || '—'}</span>
                  </div>
                ))}
              </section>

              <section className="flex min-w-0 flex-col gap-2 rounded-lg border border-hairline bg-background px-6 py-5">
                <h2 className="text-base font-normal">
                  Histori MO <span className="text-sm font-light text-ink-mute">{c.mediaOrders.length}</span>
                </h2>
                {c.mediaOrders.length === 0 ? (
                  <span className="text-sm text-ink-mute">Belum ada MO untuk klien ini.</span>
                ) : (
                  c.mediaOrders.map((m) => (
                    <Link
                      key={m.id}
                      to={`/mo/${m.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-2 py-3 text-ink hover:bg-canvas-soft hover:text-ink"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="tnum text-sm font-normal">{m.moNumber ?? 'Draft'}</span>
                        <span className="text-[13px] text-ink-mute">
                          {formatTanggal(m.moDate)} · {formatBulan(m.periodStart)} – {formatBulan(m.periodEnd)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="tnum text-sm">Rp {formatRupiah(m.totalAmount)}</span>
                        <MoStatusTags status={m.status} billingStatus={m.billingStatus} />
                      </div>
                    </Link>
                  ))
                )}
              </section>
            </div>

            <ClientFormDialog open={editing} onOpenChange={setEditing} client={c} />
            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Hapus klien {c.companyName}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Klien tidak lagi muncul di daftar dan pilihan form MO. MO yang sudah terbit tetap menyimpan data klien ini.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction size="sm" className="bg-ruby hover:bg-danger-text" disabled={remove.isPending} onClick={onDelete}>
                    Hapus klien
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </QueryState>
    </div>
  )
}
