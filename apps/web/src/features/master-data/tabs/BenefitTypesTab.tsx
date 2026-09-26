import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { benefitTypeSchema, type BenefitTypeDto } from '@inc/shared'
import type { z } from 'zod'
import { Field } from '@/components/field'
import { QueryState } from '@/components/query-state'
import { Tag } from '@/components/tag'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { applyServerErrors } from '@/lib/form-errors'
import { queryKeys } from '@/lib/query-keys'
import { useMasterList, useMasterSave } from '../api'
import { ListCard, ListRow } from '../components/list-card'

type In = z.input<typeof benefitTypeSchema>
type Out = z.output<typeof benefitTypeSchema>

export function BenefitTypesTab() {
  const query = useMasterList<BenefitTypeDto>(queryKeys.benefitTypes, '/benefit-types')
  const save = useMasterSave<Out>(queryKeys.benefitTypes, '/benefit-types')
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<BenefitTypeDto | null>(null)

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      await save.mutateAsync({ body: { name: newName.trim(), isActive: true, pdfLabel: null } })
      setNewName('')
      toast('Jenis benefit ditambahkan.')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menyimpan')
    }
  }

  return (
    <div className="flex max-w-[760px] flex-col gap-3">
      <QueryState query={query} isEmpty={(d) => d.length === 0} empty="Belum ada jenis benefit.">
        {(rows) => (
          <ListCard>
            {rows.map((b) => (
              <ListRow key={b.id} className="grid-cols-[32px_minmax(0,1fr)_auto_auto] min-[640px]:grid-cols-[32px_minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
                <span className="tnum text-ink-mute">{b.sortOrder}</span>
                <span>{b.name}</span>
                <span className="hidden font-mono text-xs text-ink-secondary min-[640px]:block">{b.code}</span>
                <Tag tone={b.isActive ? 'success' : 'neutral'}>{b.isActive ? 'Aktif' : 'Nonaktif'}</Tag>
                <Button variant="ghost" size="sm" onClick={() => setEditing(b)}>
                  Edit
                </Button>
              </ListRow>
            ))}
          </ListCard>
        )}
      </QueryState>
      <form onSubmit={add} className="flex flex-wrap gap-2">
        <Input
          aria-label="Nama jenis benefit baru"
          placeholder="Nama jenis benefit baru, mis. YouTube Shorts"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="min-w-[220px] flex-1"
        />
        <Button type="submit" size="sm" disabled={save.isPending || !newName.trim()}>
          Tambah benefit
        </Button>
      </form>
      <span className="text-[13px] text-ink-mute">Jenis benefit baru otomatis menjadi kolom di Daftar MO Finance.</span>
      {editing && <BenefitTypeDialog item={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function BenefitTypeDialog({ item, onClose }: { item: BenefitTypeDto; onClose: () => void }) {
  const save = useMasterSave<Out>(queryKeys.benefitTypes, '/benefit-types')
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<In, unknown, Out>({
    resolver: zodResolver(benefitTypeSchema),
    defaultValues: { name: item.name, pdfLabel: item.pdfLabel ?? '', sortOrder: item.sortOrder, isActive: item.isActive },
  })

  const onSubmit = handleSubmit(async (body) => {
    try {
      await save.mutateAsync({ id: item.id, body })
      toast('Jenis benefit diperbarui.')
      onClose()
    } catch (e) {
      applyServerErrors(e, setError, ['name', 'pdfLabel', 'sortOrder'])
    }
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>Edit jenis benefit</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Field id="bt-code" label="Kode" helper="Kode tidak bisa diubah karena dipakai sebagai kolom laporan.">
              <Input id="bt-code" value={item.code} disabled />
            </Field>
            <Field id="bt-name" label="Nama" required error={errors.name?.message}>
              <Input id="bt-name" aria-invalid={!!errors.name} {...register('name')} />
            </Field>
            <Field id="bt-pdf" label="Label di Detail Kerjasama" helper='Mis. "Artikel Release" → "Artikel Release 12x"' error={errors.pdfLabel?.message}>
              <Input id="bt-pdf" {...register('pdfLabel')} />
            </Field>
            <Field id="bt-sort" label="Urutan" error={errors.sortOrder?.message}>
              <Input id="bt-sort" type="number" min={0} {...register('sortOrder')} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register('isActive')} /> Aktif (bisa dipilih di form MO)
            </label>
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
