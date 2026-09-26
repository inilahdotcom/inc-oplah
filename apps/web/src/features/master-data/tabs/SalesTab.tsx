import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { salesSchema, type SalesDto } from '@inc/shared'
import type { z } from 'zod'
import { Field } from '@/components/field'
import { QueryState } from '@/components/query-state'
import { Tag } from '@/components/tag'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { applyServerErrors } from '@/lib/form-errors'
import { queryKeys } from '@/lib/query-keys'
import { useMasterList, useMasterSave, useUploadPng } from '../api'
import { ListCard, ListRow } from '../components/list-card'
import { PngUpload } from '../components/png-upload'

type In = z.input<typeof salesSchema>
type Out = z.output<typeof salesSchema>

export function SalesTab() {
  const query = useMasterList<SalesDto>(queryKeys.sales, '/sales')
  const [editing, setEditing] = useState<string | null>(null) // id sales atau 'new'
  // Ambil dari data query terbaru agar TTD yang baru diunggah langsung tampil di dialog.
  const current = query.data?.find((s) => s.id === editing)

  return (
    <div className="flex max-w-[900px] flex-col gap-3">
      <div>
        <Button size="sm" onClick={() => setEditing('new')}>
          Tambah sales
        </Button>
      </div>
      <QueryState query={query} isEmpty={(d) => d.length === 0} empty="Belum ada sales.">
        {(rows) => (
          <ListCard>
            {rows.map((s) => (
              <ListRow key={s.id} className="grid-cols-[minmax(0,1fr)_auto] min-[720px]:grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)_70px_auto_auto]">
                <div className="flex flex-col">
                  <span className="font-normal text-ink">{s.name}</span>
                  <span className="text-xs text-ink-mute min-[720px]:hidden">
                    {s.code} · {s.email ?? '—'}
                  </span>
                </div>
                <span className="hidden font-mono text-xs min-[720px]:block">{s.code}</span>
                <span className="hidden truncate text-ink-secondary min-[720px]:block">{s.email ?? '—'}</span>
                <span className="tnum hidden text-right text-ink-mute min-[720px]:block">{s.moCount} MO</span>
                <Tag tone={s.isActive ? 'success' : 'neutral'} className="hidden min-[720px]:inline-flex">
                  {s.isActive ? 'Aktif' : 'Nonaktif'}
                </Tag>
                <Button variant="ghost" size="sm" onClick={() => setEditing(s.id)}>
                  Edit
                </Button>
              </ListRow>
            ))}
          </ListCard>
        )}
      </QueryState>
      <span className="text-[13px] text-ink-mute">Kode sales dipakai di nomor MO, mis. 007/MO-BMO/INC/V/2026.</span>
      {(editing === 'new' || current) && <SalesDialog item={current} onClose={() => setEditing(null)} />}
    </div>
  )
}

function SalesDialog({ item, onClose }: { item?: SalesDto; onClose: () => void }) {
  const save = useMasterSave<Out>(queryKeys.sales, '/sales')
  const upload = useUploadPng(queryKeys.sales)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<In, unknown, Out>({
    resolver: zodResolver(salesSchema),
    defaultValues: item ? { name: item.name, code: item.code, email: item.email ?? '', title: item.title, isActive: item.isActive } : { title: 'Sales', isActive: true },
  })

  const onSubmit = handleSubmit(async (body) => {
    try {
      await save.mutateAsync({ id: item?.id, body })
      toast(item ? 'Data sales diperbarui.' : 'Sales ditambahkan.')
      onClose()
    } catch (e) {
      applyServerErrors(e, setError, ['name', 'code', 'email', 'title'])
    }
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>{item ? 'Edit sales' : 'Tambah sales'}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
              <Field id="sales-name" label="Nama" required error={errors.name?.message}>
                <Input id="sales-name" aria-invalid={!!errors.name} {...register('name')} />
              </Field>
              <Field id="sales-code" label="Kode" required error={errors.code?.message} helper={errors.code ? undefined : '2–6 huruf/angka'}>
                <Input id="sales-code" className="uppercase" aria-invalid={!!errors.code} {...register('code')} />
              </Field>
              <Field id="sales-email" label="Email" error={errors.email?.message}>
                <Input id="sales-email" type="email" aria-invalid={!!errors.email} {...register('email')} />
              </Field>
              <Field id="sales-title" label="Jabatan di PDF" required error={errors.title?.message}>
                <Input id="sales-title" aria-invalid={!!errors.title} {...register('title')} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register('isActive')} /> Aktif
            </label>
            {item && (
              <PngUpload
                label="Tanda tangan"
                url={item.signatureUrl}
                disabled={upload.isPending}
                onUpload={(file) => upload.mutateAsync({ path: `/sales/${item.id}/signature`, file })}
              />
            )}
          </DialogBody>
          <DialogFooter showCloseButton>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
