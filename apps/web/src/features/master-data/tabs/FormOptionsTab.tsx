import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { formOptionGroup, formOptionGroupLabel, formOptionSchema, type FormOptionDto, type FormOptionGroup } from '@inc/shared'
import type { z } from 'zod'
import { Field, selectClass } from '@/components/field'
import { QueryState } from '@/components/query-state'
import { Tag } from '@/components/tag'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { applyServerErrors } from '@/lib/form-errors'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { useMasterList, useMasterSave } from '../api'
import { ListCard, ListRow } from '../components/list-card'

type In = z.input<typeof formOptionSchema>
type Out = z.output<typeof formOptionSchema>

/** Opsi checkbox form MO (FR-MD-04). Urutan = urutan cetak di PDF. */
export function FormOptionsTab() {
  const query = useMasterList<FormOptionDto>(queryKeys.formOptions, '/form-options')
  const [editing, setEditing] = useState<{ group: FormOptionGroup; item?: FormOptionDto } | null>(null)

  return (
    <div className="flex max-w-[760px] flex-col gap-6">
      <QueryState query={query} rows={6}>
        {(rows) =>
          formOptionGroup.map((group) => (
            <section key={group} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-normal">{formOptionGroupLabel[group]}</h2>
                <Button variant="ghost" size="sm" onClick={() => setEditing({ group })}>
                  + Tambah opsi
                </Button>
              </div>
              <ListCard>
                {rows
                  .filter((o) => o.group === group)
                  .map((o) => (
                    <ListRow key={o.id} className="grid-cols-[minmax(0,1fr)_auto_auto] min-[640px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
                      <span className={cn(o.parentCode && 'pl-5 text-ink-secondary')}>{o.label}</span>
                      <span className="hidden font-mono text-xs text-ink-secondary min-[640px]:block">{o.code}</span>
                      <Tag tone={o.isActive ? 'success' : 'neutral'}>{o.isActive ? 'Aktif' : 'Nonaktif'}</Tag>
                      <Button variant="ghost" size="sm" onClick={() => setEditing({ group, item: o })}>
                        Edit
                      </Button>
                    </ListRow>
                  ))}
              </ListCard>
            </section>
          ))
        }
      </QueryState>
      {editing && (
        <FormOptionDialog
          group={editing.group}
          item={editing.item}
          parents={(query.data ?? []).filter((o) => o.group === editing.group && !o.parentCode && o.id !== editing.item?.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function FormOptionDialog({ group, item, parents, onClose }: { group: FormOptionGroup; item?: FormOptionDto; parents: FormOptionDto[]; onClose: () => void }) {
  const save = useMasterSave<Out>(queryKeys.formOptions, '/form-options')
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<In, unknown, Out>({
    resolver: zodResolver(formOptionSchema),
    defaultValues: item
      ? { group, code: item.code, label: item.label, parentCode: item.parentCode ?? '', sortOrder: item.sortOrder, isActive: item.isActive }
      : { group, label: '', parentCode: '', isActive: true },
  })

  const onSubmit = handleSubmit(async (body) => {
    try {
      await save.mutateAsync({ id: item?.id, body })
      toast(item ? 'Opsi diperbarui.' : 'Opsi ditambahkan.')
      onClose()
    } catch (e) {
      applyServerErrors(e, setError, ['label', 'code', 'parentCode', 'sortOrder'])
    }
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>
              {item ? 'Edit opsi' : 'Tambah opsi'} · {formOptionGroupLabel[group]}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Field id="opt-label" label="Label (dicetak di PDF)" required error={errors.label?.message}>
              <Input id="opt-label" aria-invalid={!!errors.label} {...register('label')} />
            </Field>
            {item ? (
              <Field id="opt-code" label="Kode" helper="Kode tidak bisa diubah karena tersimpan di MO.">
                <Input id="opt-code" value={item.code} disabled />
              </Field>
            ) : (
              <Field id="opt-code" label="Kode" helper="Kosongkan untuk dibuat otomatis dari label." error={errors.code?.message}>
                <Input id="opt-code" className="uppercase" {...register('code')} />
              </Field>
            )}
            {parents.length > 0 && (
              <Field id="opt-parent" label="Induk" error={errors.parentCode?.message} helper="Opsi anak hanya aktif di form bila induknya dicentang.">
                <select id="opt-parent" className={selectClass} {...register('parentCode')}>
                  <option value="">— Tanpa induk —</option>
                  {parents.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {item && (
              <Field id="opt-sort" label="Urutan" error={errors.sortOrder?.message}>
                <Input id="opt-sort" type="number" min={0} {...register('sortOrder')} />
              </Field>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register('isActive')} /> Aktif
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
