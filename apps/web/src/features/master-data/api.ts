import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import type { SettingsDto, SettingsInput } from '@inc/shared'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

/** GET list master data (`{ data: T[] }`). */
export function useMasterList<T>(key: QueryKey, path: string) {
  return useQuery({ queryKey: key, queryFn: () => api<{ data: T[] }>(path).then((r) => r.data) })
}

/** POST (tanpa id) / PATCH (dengan id) ke `path`, lalu invalidasi list. */
export function useMasterSave<TBody, TRes = unknown>(key: QueryKey, path: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: TBody }) =>
      api<TRes>(id ? `${path}/${id}` : path, { method: id ? 'PATCH' : 'POST', json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })
}

/** Upload PNG (field `file`) ke `path`, lalu invalidasi list. */
export function useUploadPng(key: QueryKey) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ path, file }: { path: string; file: File }) => {
      const body = new FormData()
      body.append('file', file)
      return api<{ url: string | null }>(path, { method: 'POST', body })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })
}

export function useSettings() {
  return useQuery({ queryKey: queryKeys.settings, queryFn: () => api<SettingsDto>('/settings') })
}

export function useSaveSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SettingsInput) => api<SettingsDto>('/settings', { method: 'PATCH', json: body }),
    onSuccess: (data) => qc.setQueryData(queryKeys.settings, data),
  })
}

/** Bagian pengaturan yang bisa diubah (tanpa `nextSeq` yang hanya-baca). */
export const settingsBody = (d: SettingsDto): SettingsInput => ({
  company: d.company,
  tax: d.tax,
  numbering: d.numbering,
  termsTemplates: d.termsTemplates,
})
