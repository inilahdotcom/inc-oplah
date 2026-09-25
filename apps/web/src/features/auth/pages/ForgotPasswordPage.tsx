import { Link } from 'react-router-dom'
import { GradientMesh } from '@/components/gradient-mesh'

// FR-AUTH-02 ditunda (lihat docs/ASSUMPTIONS.md): reset via email belum tersedia.
export function ForgotPasswordPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <GradientMesh />
      <div className="relative flex w-full max-w-[420px] flex-col gap-4 rounded-lg border border-hairline bg-background p-8 shadow-l2">
        <h1 className="text-[26px] leading-[1.12] font-light tracking-[-0.26px]">Lupa password</h1>
        <p className="text-sm text-ink-mute">
          Reset password lewat email belum tersedia. Hubungi Super Admin untuk mengatur ulang password Anda.
        </p>
        <Link to="/login" className="text-sm">
          ← Kembali ke halaman masuk
        </Link>
      </div>
    </div>
  )
}
