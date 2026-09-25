import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { createUserSchema, formatTanggal, roleLabel, roles, type SalesDto, type UserDto } from '@inc/shared'
import { z } from 'zod'
import { Field, selectClass } from '@/components/field'
import { QueryState } from '@/components/query-state'
import { Tag } from '@/components/tag'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCurrentUser } from '@/lib/auth-store'
import { applyServerErrors } from '@/lib/form-errors'
import { queryKeys } from '@/lib/query-keys'
import { useMasterList, useMasterSave } from '../api'
import { checkboxClass } from '../components/list-card'

export function UsersTab() {
  const query = useMasterList<UserDto>(queryKeys.users, '/users')
  const [editing, setEditing] = useState<UserDto | 'new' | null>(null)

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button size="sm" onClick={() => setEditing('new')}>
          Tambah pengguna
        </Button>
      </div>
      <QueryState query={query} isEmpty={(d) => d.length === 0}>
        {(rows) => (
          <div className="overflow-x-auto rounded-lg border border-hairline bg-background">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Nama</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Sales</TableHead>
                  <TableHead>Login terakhir</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-normal text-ink">{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{roleLabel[u.role]}</TableCell>
                    <TableCell>{u.sales ? `${u.sales.name} (${u.sales.code})` : '—'}</TableCell>
                    <TableCell className="tnum whitespace-nowrap">{u.lastLoginAt ? formatTanggal(u.lastLoginAt) : '—'}</TableCell>
                    <TableCell>
                      <Tag tone={u.isActive ? 'success' : 'neutral'}>{u.isActive ? 'Aktif' : 'Nonaktif'}</Tag>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(u)}>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryState>
      {editing && <UserDialog item={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

// Satu dialog untuk tambah & edit; skema berbeda (password wajib saat tambah, opsional saat edit).
const formSchema = z.object({
  name: createUserSchema.shape.name,
  email: createUserSchema.shape.email,
  role: createUserSchema.shape.role.optional(), // undefined bila select dinonaktifkan (akun sendiri)
  salesId: z.string(), // '' = tidak ditautkan
  password: createUserSchema.shape.password.or(z.literal('')),
  isActive: z.boolean().optional(),
})
type In = z.input<typeof formSchema>
type Out = z.output<typeof formSchema>

function UserDialog({ item, onClose }: { item?: UserDto; onClose: () => void }) {
  const me = useCurrentUser()
  const isSelf = item?.id === me.id
  const sales = useMasterList<SalesDto>(queryKeys.sales, '/sales')
  const save = useMasterSave<unknown>(queryKeys.users, '/users')
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<In, unknown, Out>({
    resolver: zodResolver(formSchema),
    defaultValues: item
      ? { name: item.name, email: item.email, role: item.role, salesId: item.salesId ?? '', isActive: item.isActive, password: '' }
      : { role: 'ADMIN_SALES', isActive: true, password: '', salesId: '' },
  })
  const role = watch('role')

  const onSubmit = handleSubmit(async ({ password, email, salesId, ...rest }) => {
    if (!item && !password) return setError('password', { message: 'Password wajib diisi' })
    const body = {
      ...rest,
      salesId: (rest.role ?? item?.role) === 'ADMIN_SALES' && salesId ? salesId : null,
      ...(password && { password }),
      ...(!item && { email }),
    }
    try {
      await save.mutateAsync({ id: item?.id, body })
      toast(item ? 'Pengguna diperbarui.' : 'Pengguna ditambahkan.')
      onClose()
    } catch (e) {
      applyServerErrors(e, setError, ['name', 'email', 'role', 'salesId', 'password'])
    }
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>{item ? 'Edit pengguna' : 'Tambah pengguna'}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Field id="user-name" label="Nama" required error={errors.name?.message}>
              <Input id="user-name" aria-invalid={!!errors.name} {...register('name')} />
            </Field>
            <Field id="user-email" label="Email" required error={errors.email?.message} helper={item ? 'Email tidak bisa diubah.' : undefined}>
              <Input id="user-email" type="email" readOnly={!!item} aria-invalid={!!errors.email} {...register('email')} />
            </Field>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
              <Field id="user-role" label="Role" required helper={isSelf ? 'Role akun sendiri tidak bisa diubah.' : undefined}>
                <select id="user-role" className={selectClass} disabled={isSelf} {...register('role')}>
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel[r]}
                    </option>
                  ))}
                </select>
              </Field>
              {role === 'ADMIN_SALES' && (
                <Field id="user-sales" label="Tautkan ke sales" error={errors.salesId?.message}>
                  <select id="user-sales" className={selectClass} {...register('salesId')}>
                    <option value="">— Tidak ditautkan —</option>
                    {sales.data?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
            <Field
              id="user-password"
              label={item ? 'Password baru' : 'Password'}
              required={!item}
              error={errors.password?.message}
              helper={item ? 'Kosongkan bila tidak diganti. Mengganti password akan mengeluarkan semua sesi user.' : 'Minimal 8 karakter'}
            >
              <Input id="user-password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register('password')} />
            </Field>
            {item && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className={checkboxClass} disabled={isSelf} {...register('isActive')} /> Aktif (nonaktif = tidak bisa login, sesi dicabut)
              </label>
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
