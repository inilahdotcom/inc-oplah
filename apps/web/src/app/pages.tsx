import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/page-header'
import { buttonVariants } from '@/components/ui/button'

export function ForbiddenPage() {
  return (
    <div className="flex flex-col items-start gap-4">
      <PageHeader eyebrow="403" title="Anda tidak memiliki akses" />
      <p className="text-sm text-ink-mute">Halaman ini tidak tersedia untuk role Anda. Hubungi Super Admin bila butuh akses.</p>
      <Link to="/" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
        Kembali ke beranda
      </Link>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-start gap-4">
      <PageHeader eyebrow="404" title="Halaman tidak ditemukan" />
      <Link to="/" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
        Kembali ke beranda
      </Link>
    </div>
  )
}

export function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
      <span className="size-6 animate-spin rounded-full border-2 border-hairline border-t-primary" />
      <span className="sr-only">Memuat…</span>
    </div>
  )
}
