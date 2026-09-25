import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { QueryState } from '@/components/query-state'
import { RoleGate } from '@/components/role-gate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDebounce } from '@/lib/use-debounce'
import { PAGE_SIZE, useClients } from '../api'
import { ClientFormDialog } from '../components/ClientFormDialog'

export function ClientListPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [search, setSearch] = useState(params.get('q') ?? '')
  const q = useDebounce(search.trim(), 300)
  const [adding, setAdding] = useState(false)

  // Filter disimpan di URL agar bisa dibagikan & bertahan saat refresh (ARCHITECTURE §5).
  useEffect(() => {
    if ((params.get('q') ?? '') !== q) setParams(q ? { q } : {}, { replace: true })
  }, [q, params, setParams])

  const query = useClients({ q: q || undefined, page })
  const setPage = (p: number) => setParams({ ...(q && { q }), page: String(p) })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[26px] leading-[1.12] font-light tracking-[-0.26px]">Klien</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-[260px] max-w-full">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-mute" aria-hidden />
            <Input
              type="search"
              aria-label="Cari perusahaan atau PIC"
              placeholder="Cari perusahaan atau PIC"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-[34px] py-1 pl-9 text-sm"
            />
          </div>
          <RoleGate permission="manageClients">
            <Button size="sm" onClick={() => setAdding(true)}>
              Tambah klien
            </Button>
          </RoleGate>
        </div>
      </div>

      <QueryState
        query={query}
        isEmpty={(d) => d.data.length === 0}
        empty={q ? `Klien "${q}" tidak ditemukan.` : 'Belum ada klien. Tambahkan klien pertama Anda.'}
      >
        {(d) => (
          <>
            <div className="overflow-x-auto rounded-lg border border-hairline bg-background">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Perusahaan / Biro Iklan</TableHead>
                    <TableHead>PIC</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>No. Telp</TableHead>
                    <TableHead>Kota</TableHead>
                    <TableHead className="text-right">Jumlah MO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.data.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/klien/${c.id}`)}>
                      <TableCell className="font-normal text-ink">
                        {/* Link agar baris bisa dibuka dengan keyboard */}
                        <a href={`/klien/${c.id}`} onClick={(e) => e.preventDefault()} className="text-ink hover:text-ink focus-visible:underline">
                          {c.companyName}
                        </a>
                      </TableCell>
                      <TableCell>{c.picName}</TableCell>
                      <TableCell>{c.email ?? '—'}</TableCell>
                      <TableCell className="tnum whitespace-nowrap">{c.phone ?? '—'}</TableCell>
                      <TableCell>{c.city ?? '—'}</TableCell>
                      <TableCell className="tnum text-right text-ink">{c.moCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {d.total > PAGE_SIZE && (
              <div className="flex items-center justify-between gap-3 text-sm text-ink-mute">
                <span className="tnum">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, d.total)} dari {d.total} klien
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    Sebelumnya
                  </Button>
                  <Button variant="secondary" size="sm" disabled={page * PAGE_SIZE >= d.total} onClick={() => setPage(page + 1)}>
                    Berikutnya
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </QueryState>

      <ClientFormDialog open={adding} onOpenChange={setAdding} onSaved={(c) => navigate(`/klien/${c.id}`)} />
    </div>
  )
}
