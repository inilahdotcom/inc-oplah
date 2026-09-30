import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { password } from '@inc/shared'
import { Field } from '@/components/field'
import { GradientMesh } from '@/components/gradient-mesh'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, ApiError } from '@/lib/api-client'

const schema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Konfirmasi password tidak sama' })
type FormValues = z.infer<typeof schema>

export function ResetPasswordPage() {
  const token = useSearchParams()[0].get('token') ?? ''
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } })

  const onSubmit = handleSubmit(async ({ password }) => {
    try {
      await api('/auth/reset-password', { method: 'POST', json: { token, password } })
      toast('Password berhasil diubah. Silakan masuk.')
      navigate('/login', { replace: true })
    } catch (e) {
      if (e instanceof ApiError && e.status < 500) setError('confirm', { message: e.message })
      else toast('Tidak dapat terhubung ke server. Coba lagi.')
    }
  })

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <GradientMesh />
      <form
        onSubmit={onSubmit}
        noValidate
        className="relative flex w-full max-w-[420px] flex-col gap-5 rounded-lg border border-hairline bg-background p-8 shadow-l2"
      >
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] leading-[1.12] font-light tracking-[-0.26px]">Atur ulang password</h1>
          <p className="text-sm text-ink-mute">
            {token ? 'Masukkan password baru Anda.' : 'Link reset tidak valid. Minta link baru dari halaman lupa password.'}
          </p>
        </div>

        {token && (
          <>
            <Field id="password" label="Password baru" error={errors.password?.message}>
              <Input id="password" type="password" autoComplete="new-password" autoFocus aria-invalid={!!errors.password} {...register('password')} />
            </Field>
            <Field id="confirm" label="Konfirmasi password" error={errors.confirm?.message}>
              <Input id="confirm" type="password" autoComplete="new-password" aria-invalid={!!errors.confirm} {...register('confirm')} />
            </Field>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Memproses…' : 'Simpan password'}
            </Button>
          </>
        )}

        <Link to={token ? '/login' : '/lupa-password'} className="text-sm">
          {token ? '← Kembali ke halaman masuk' : 'Minta link baru'}
        </Link>
      </form>
    </div>
  )
}
