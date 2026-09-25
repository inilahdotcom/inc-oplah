import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ClientDetailDto, ClientDto, ClientInput, ClientListItem, Paginated } from '@inc/shared'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

export const PAGE_SIZE = 50

export function useClients(params: { q?: string; page: number }) {
  return useQuery({
    queryKey: queryKeys.clients.list(params),
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(params.page), limit: String(PAGE_SIZE), ...(params.q && { q: params.q }) })
      return api<Paginated<ClientListItem>>(`/clients?${qs}`)
    },
    placeholderData: keepPreviousData,
  })
}

export function useClient(id: string) {
  return useQuery({ queryKey: queryKeys.clients.detail(id), queryFn: () => api<ClientDetailDto>(`/clients/${id}`) })
}

export function useSimilarClients(name: string, excludeId?: string) {
  return useQuery({
    queryKey: queryKeys.clients.similar(name, excludeId),
    queryFn: () => {
      const qs = new URLSearchParams({ name, ...(excludeId && { excludeId }) })
      return api<{ data: { id: string; companyName: string }[] }>(`/clients/similar?${qs}`).then((r) => r.data)
    },
    enabled: name.trim().length >= 3,
    staleTime: 30_000,
  })
}

export function useSaveClient(id?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ClientInput) =>
      api<ClientDto>(id ? `/clients/${id}` : '/clients', { method: id ? 'PATCH' : 'POST', json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.clients.all }),
  })
}

export function useDeleteClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/clients/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.clients.all }),
  })
}
