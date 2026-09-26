import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MediaOrderDto, MoDraftInput, TaxResult } from '@inc/shared'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { useDebounce } from '@/lib/use-debounce'

export function useMediaOrder(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.mediaOrders.detail(id ?? ''), queryFn: () => api<MediaOrderDto>(`/media-orders/${id}`), enabled: !!id })
}

// Histori MO tampil di detail klien, jadi cache klien ikut diinvalidasi.
function useInvalidate() {
  const qc = useQueryClient()
  return () => Promise.all([qc.invalidateQueries({ queryKey: queryKeys.mediaOrders.all }), qc.invalidateQueries({ queryKey: queryKeys.clients.all })])
}

/** POST draft baru atau PATCH draft yang ada. */
export function useSaveMo() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: MoDraftInput }) =>
      api<MediaOrderDto>(id ? `/media-orders/${id}` : '/media-orders', { method: id ? 'PATCH' : 'POST', json: body }),
    onSuccess: invalidate,
  })
}

export type MoAction = 'submit' | 'cancel' | 'revise' | 'duplicate'

export function useMoAction() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, action, body }: { id: string; action: MoAction; body?: unknown }) =>
      api<MediaOrderDto>(`/media-orders/${id}/${action}`, { method: 'POST', json: body }),
    onSuccess: invalidate,
  })
}

export function useDeleteMo() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (id: string) => api<void>(`/media-orders/${id}`, { method: 'DELETE' }), onSuccess: invalidate })
}

export function useRegeneratePdf() {
  return useMutation({ mutationFn: (id: string) => api<void>(`/media-orders/${id}/pdf/regenerate`, { method: 'POST' }) })
}

export function useUploadAttachment(id: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (file: File) => {
      const body = new FormData()
      body.append('file', file)
      return api<MediaOrderDto>(`/media-orders/${id}/attachments`, { method: 'POST', body })
    },
    onSuccess: invalidate,
  })
}

/** Ringkasan pajak dari backend (AGENT.md §3: frontend tidak menghitung pajak), debounce 300 ms. */
export function useCalculate(subtotal: string, isTaxable: boolean) {
  const s = useDebounce(subtotal || '0', 300)
  const t = useDebounce(isTaxable, 300)
  return useQuery({
    queryKey: queryKeys.mediaOrders.calculate(s, t),
    queryFn: () => api<TaxResult>('/media-orders/calculate', { method: 'POST', json: { subtotal: s, isTaxable: t } }),
    enabled: /^\d{1,15}$/.test(s),
    placeholderData: (prev) => prev,
    staleTime: Infinity,
  })
}
