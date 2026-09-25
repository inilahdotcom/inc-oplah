import { cn } from '@/lib/utils'

/** Kartu daftar bergaris (gaya list master data di prototipe). */
export function ListCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('overflow-hidden rounded-lg border border-hairline bg-background', className)}>{children}</div>
}

export function ListRow({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('grid items-center gap-3 border-b border-hairline px-4 py-3 text-sm last:border-b-0', className)}>{children}</div>
}


export const checkboxClass = 'size-4 accent-primary'
