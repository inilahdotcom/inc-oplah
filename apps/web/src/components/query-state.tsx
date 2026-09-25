import type { UseQueryResult } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Tiga state wajib halaman data (AGENT.md §4): loading (skeleton), error (pesan + coba lagi), kosong.
 * Merender `children(data)` bila data ada dan tidak kosong.
 */
export function QueryState<T>({
  query,
  isEmpty,
  empty,
  rows = 5,
  children,
}: {
  query: UseQueryResult<T>
  isEmpty?: (data: T) => boolean
  empty?: React.ReactNode
  rows?: number
  children: (data: T) => React.ReactNode
}) {
  if (query.isPending) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Memuat data">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-md bg-canvas-soft" />
        ))}
      </div>
    )
  }
  if (query.isError) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-hairline p-6">
        <span className="text-sm text-ink-secondary">{query.error.message || 'Gagal memuat data.'}</span>
        <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
          Coba lagi
        </Button>
      </div>
    )
  }
  if (isEmpty?.(query.data)) {
    return <div className="rounded-lg border border-hairline p-8 text-center text-sm text-ink-mute">{empty ?? 'Belum ada data.'}</div>
  }
  return <>{children(query.data)}</>
}
