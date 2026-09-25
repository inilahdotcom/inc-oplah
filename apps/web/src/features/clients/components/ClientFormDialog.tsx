import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { clientSchema, type ClientDto, type ClientInput } from '@inc/shared'
import type { z } from 'zod'
import { Field, Notice } from '@/components/field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { applyServerErrors } from '@/lib/form-errors'
import { useDebounce } from '@/lib/use-debounce'
import { useSaveClient, useSimilarClients } from '../api'

type Values = z.output<typeof clientSchema>

const empty: ClientInput = { companyName: '', picName: '', email: '', phone: '', nik: '', city: '', postalCode: '', address: '', npwp: '' }
const toForm = (c: ClientDto): ClientInput => ({ ...empty, ...Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v ?? ''])) })

/** Modal Tambah/Edit klien (README desain §6). Dipakai di daftar & detail klien, dan nanti di form MO (FR-CL-04). */
export function ClientFormDialog({
  open,
  onOpenChange,
  client,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  client?: ClientDto
  onSaved?: (client: ClientDto) => void
}) {
  const save = useSaveClient(client?.id)
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ClientInput, unknown, Values>({ resolver: zodResolver(clientSchema), defaultValues: empty })

  useEffect(() => {
    if (open) reset(client ? toForm(client) : empty)
  }, [open, client, reset])

  const companyName = useDebounce(watch('companyName') ?? '', 300)
  const similar = useSimilarClients(companyName, client?.id)
  const dupe = similar.data?.[0]

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync(values)
      toast(client ? 'Data klien diperbarui.' : 'Klien baru tersimpan.')
      onOpenChange(false)
      onSaved?.(saved)
    } catch (e) {
      applyServerErrors(e, setError, Object.keys(empty))
    }
  })

  const field = (name: keyof ClientInput, label: string, opts: { required?: boolean; helper?: string; type?: string; inputMode?: 'numeric' | 'tel' | 'email' } = {}) => (
    <Field id={`client-${name}`} label={label} required={opts.required} error={errors[name]?.message} helper={opts.helper}>
      <Input
        id={`client-${name}`}
        type={opts.type ?? 'text'}
        inputMode={opts.inputMode}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] || opts.helper ? `client-${name}-message` : undefined}
        {...register(name)}
      />
    </Field>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>{client ? 'Edit klien' : 'Tambah klien baru'}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {field('companyName', 'Perusahaan / Biro Iklan', { required: true })}
            {dupe && (
              <Notice tone="warning">
                Mirip dengan klien yang sudah ada: {dupe.companyName}. Pastikan bukan duplikat.
              </Notice>
            )}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
              {field('picName', 'Nama PIC', { required: true })}
              {field('email', 'Email', { required: true, type: 'email', inputMode: 'email' })}
              {field('phone', 'No. Telp', { required: true, type: 'tel', inputMode: 'tel' })}
              {field('nik', 'Nomor NIK', { inputMode: 'numeric', helper: '16 digit' })}
              {field('city', 'Kota')}
              {field('postalCode', 'Kode Pos', { inputMode: 'numeric' })}
            </div>
            {field('address', 'Alamat')}
            {field('npwp', 'NPWP', { helper: 'Opsional, untuk kebutuhan penagihan' })}
          </DialogBody>
          <DialogFooter showCloseButton>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Menyimpan…' : 'Simpan klien'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
