import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { toast } from 'sonner'
import { ApiError } from './api-client'

/** Petakan error validasi API (details per field) ke form; selain itu tampilkan toast. */
export function applyServerErrors<T extends FieldValues>(e: unknown, setError: UseFormSetError<T>, fields: readonly string[]) {
  if (e instanceof ApiError && e.details.length) {
    const known = e.details.filter((d) => fields.includes(d.field))
    known.forEach((d) => setError(d.field as Path<T>, { message: d.message }))
    if (known.length) return
  }
  toast(e instanceof Error ? e.message : 'Gagal menyimpan')
}
