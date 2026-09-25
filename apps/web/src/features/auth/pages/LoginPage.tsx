import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { loginSchema, type LoginInput } from '@inc/shared'
import { GradientMesh } from '@/components/gradient-mesh'
import { LogoMark } from '@/components/logo-mark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api-client'
import { useAuth } from '@/lib/auth-store'

// Akun hasil seed development (apps/api/prisma/seed.ts). Tidak tampil di build produksi.
const demoAccounts = [
  { role: 'Admin Sales', email: 'sales@inilah.local' },
  { role: 'Finance', email: 'finance@inilah.local' },
  { role: 'Super Admin', email: 'superadmin@inilah.local' },
  { role: 'Viewer', email: 'viewer@inilah.local' },
]

export function LoginPage() {
  const { state, login } = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/'
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })

  if (state.status === 'authenticated') return <Navigate to={from} replace />

  const onSubmit = handleSubmit(async (input) => {
    try {
      await login(input)
      navigate(from, { replace: true })
    } catch (e) {
      if (e instanceof ApiError && e.status < 500) setError('password', { message: e.message })
      else toast('Tidak dapat terhubung ke server. Coba lagi.')
    }
  })

  const passwordError = errors.password?.message

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <GradientMesh />
      <form
        onSubmit={onSubmit}
        noValidate
        className="relative flex w-full max-w-[420px] flex-col gap-5 rounded-lg border border-hairline bg-background p-8 shadow-l2"
      >
        <div className="flex items-center gap-2.5">
          <LogoMark className="size-7 text-[13px]" />
          <div className="flex flex-col">
            <span className="text-sm font-normal">Inilah.com</span>
            <span className="text-xs text-ink-mute">Client &amp; Media Order Management</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] leading-[1.12] font-light tracking-[-0.26px]">Masuk ke akun Anda</h1>
          <p className="text-sm text-ink-mute">Gunakan email kantor yang terdaftar.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" className="text-sm font-normal text-ink-secondary">
            Email
          </Label>
          <Input id="email" type="email" autoComplete="email" autoFocus aria-invalid={!!errors.email} {...register('email')} />
          {errors.email && <span className="text-[13px] tracking-[-0.39px] text-ruby">{errors.email.message}</span>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password" className="text-sm font-normal text-ink-secondary">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!passwordError}
            aria-describedby={passwordError ? 'password-error' : undefined}
            {...register('password')}
          />
          {passwordError && (
            <span id="password-error" role="alert" className="text-[13px] tracking-[-0.39px] text-ruby">
              {passwordError}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/lupa-password" className="text-sm">
            Lupa password?
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Memproses…' : 'Masuk'}
            <ChevronRight strokeWidth={2.25} />
          </Button>
        </div>

        {import.meta.env.DEV && (
          <div className="flex flex-col gap-2 border-t border-hairline pt-4">
            <span className="text-xs text-ink-mute">Akun demo (password: password123)</span>
            <div className="flex flex-wrap gap-2">
              {demoAccounts.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => {
                    setValue('email', d.email)
                    setValue('password', 'password123')
                  }}
                  className="flex flex-col gap-0.5 rounded-md border border-hairline bg-canvas-soft px-3 py-2 text-left text-[13px] hover:border-primary"
                >
                  <span className="font-normal">{d.role}</span>
                  <span className="text-xs text-ink-mute">{d.email}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
