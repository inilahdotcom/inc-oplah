import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { forgotPasswordSchema, type ForgotPasswordInput } from '@inc/shared'
import { Field } from '@/components/field'
import { GradientMesh } from '@/components/gradient-mesh'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, ApiError } from '@/lib/api-client'

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } })

  const onSubmit = handleSubmit(async (json) => {
    try {
      await api('/auth/forgot-password', { method: 'POST', json })
      setSent(true)
    } catch (e) {
      toast(e instanceof ApiError && e.status < 500 ? e.message : 'Tidak dapat terhubung ke server. Coba lagi.')
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
          <h1 className="text-[26px] leading-[1.12] font-light tracking-[-0.26px]">Lupa password</h1>
          <p className="text-sm text-ink-mute">
            {sent
              ? 'Jika email terdaftar, link reset password sudah dikirim. Periksa kotak masuk Anda.'
              : 'Masukkan email akun Anda. Kami akan mengirim link untuk mengatur ulang password.'}
          </p>
        </div>

        {!sent && (
          <>
            <Field id="email" label="Email" error={errors.email?.message}>
              <Input id="email" type="email" autoComplete="email" autoFocus aria-invalid={!!errors.email} {...register('email')} />
            </Field>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Memproses…' : 'Kirim link reset'}
            </Button>
          </>
        )}

        <Link to="/login" className="text-sm">
          ← Kembali ke halaman masuk
        </Link>
      </form>
    </div>
  )
}
