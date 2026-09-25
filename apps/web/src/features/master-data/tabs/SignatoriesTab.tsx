import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { signatoryRole, signatoryRoleLabel, signatorySchema, type SignatoryDto } from '@inc/shared'
import type { z } from 'zod'
import { Field, selectClass } from '@/components/field'
import { QueryState } from '@/components/query-state'
import { Tag } from '@/components/tag'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { applyServerErrors } from '@/lib/form-errors'
import { queryKeys } from '@/lib/query-keys'
import { useMasterList, useMasterSave, useUploadPng } from '../api'
import { checkboxClass } from '../components/list-card'
import { PngUpload } from '../components/png-upload'

type In = z.input<typeof signatorySchema>
type Out = z.output<typeof signatorySchema>

const card = 'flex flex-col gap-3 rounded-lg border border-hairline bg-background p-5'

export function SignatoriesTab() {
  const query = useMasterList<SignatoryDto>(queryKeys.signatories, '/signatories')
  const upload = useUploadPng(queryKeys.signatories)
  const [editing, setEditing] = useState<string | null>(null) // id atau 'new'
  const current = query.data?.find((s) => s.id === editing)

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button size="sm" onClick={() => setEditing('new')}>
          Tambah penandatangan
        </Button>
      </div>
      <QueryState query={query} rows={3}>
        {(rows) => (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-3">
            <div className={card}>
              <span className="text-xs text-ink-mute">Dibuat oleh</span>
              <div className="flex h-[72px] items-center justify-center rounded-md border border-dashed border-hairline-input text-center text-xs text-ink-mute">
                Tanda tangan sales pada MO
              </div>
              <div className="flex flex-col">
                <span className="text-[15px] font-normal">Sales pada MO</span>
                <span className="text-[13px] text-ink-mute">
                  TTD diatur di tab <Link to="/pengaturan/sales">Sales</Link>
                </span>
              </div>
            </div>
            {rows.map((s) => (
              <div key={s.id} className={card}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-ink-mute">{signatoryRoleLabel[s.docRole]}</span>
                  <div className="flex gap-1">
                    {s.isDefault && <Tag tone="soft">Default</Tag>}
                    {!s.isActive && <Tag tone="neutral">Nonaktif</Tag>}
                  </div>
                </div>
                <PngUpload
                  label="Tanda tangan"
                  url={s.signatureUrl}
                  disabled={upload.isPending}
                  onUpload={(file) => upload.mutateAsync({ path: `/signatories/${s.id}/signature`, file })}
                />
                <div className="flex flex-col">
                  <span className="text-[15px] font-normal">{s.name}</span>
                  <span className={s.docRole === 'APPROVED_BY' ? 'text-[13px] text-ink-mute italic' : 'text-[13px] text-ink-mute'}>{s.title}</span>
                </div>
                {s.docRole === 'APPROVED_BY' && (
                  <PngUpload
                    label="Stempel"
                    url={s.stampUrl}
                    disabled={upload.isPending}
                    onUpload={(file) => upload.mutateAsync({ path: `/signatories/${s.id}/stamp`, file })}
                  />
                )}
                <Button variant="secondary" size="sm" className="mt-auto w-fit" onClick={() => setEditing(s.id)}>
                  Edit
                </Button>
              </div>
            ))}
          </div>
        )}
      </QueryState>
      {(editing === 'new' || current) && <SignatoryDialog item={current} onClose={() => setEditing(null)} />}
    </div>
  )
}

function SignatoryDialog({ item, onClose }: { item?: SignatoryDto; onClose: () => void }) {
  const save = useMasterSave<Out>(queryKeys.signatories, '/signatories')
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<In, unknown, Out>({
    resolver: zodResolver(signatorySchema),
    defaultValues: item
      ? { name: item.name, title: item.title, docRole: item.docRole, isDefault: item.isDefault, isActive: item.isActive }
      : { docRole: 'ACKNOWLEDGED_BY', isDefault: false, isActive: true },
  })

  const onSubmit = handleSubmit(async (body) => {
    try {
      await save.mutateAsync({ id: item?.id, body })
      toast(item ? 'Penandatangan diperbarui.' : 'Penandatangan ditambahkan.')
      onClose()
    } catch (e) {
      applyServerErrors(e, setError, ['name', 'title', 'docRole'])
    }
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>{item ? 'Edit penandatangan' : 'Tambah penandatangan'}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Field id="sig-name" label="Nama" required error={errors.name?.message}>
              <Input id="sig-name" aria-invalid={!!errors.name} {...register('name')} />
            </Field>
            <Field id="sig-title" label="Jabatan" required error={errors.title?.message}>
              <Input id="sig-title" aria-invalid={!!errors.title} {...register('title')} />
            </Field>
            <Field id="sig-role" label="Peran di dokumen" required>
              <select id="sig-role" className={selectClass} {...register('docRole')}>
                {signatoryRole.map((r) => (
                  <option key={r} value={r}>
                    {signatoryRoleLabel[r]}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className={checkboxClass} {...register('isDefault')} /> Jadikan default untuk peran ini
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className={checkboxClass} {...register('isActive')} /> Aktif
            </label>
            {!item && <span className="text-[13px] text-ink-mute">Tanda tangan dan stempel bisa diunggah setelah disimpan.</span>}
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
