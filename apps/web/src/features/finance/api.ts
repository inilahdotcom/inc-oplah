import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AuditEntryDto, BillingDto, DashboardDto, MoListResponse } from '@inc/shared'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

/** `params` = query string Daftar MO apa adanya dari URL (filter tersimpan di URL). */
export function useMoList(params: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.mediaOrders.list(params),
    queryFn: () => api<MoListResponse>(`/media-orders?${new URLSearchParams(params)}`),
    placeholderData: keepPreviousData,
  })
}

export function useDashboard(year: number) {
  return useQuery({ queryKey: queryKeys.dashboard(year), queryFn: () => api<DashboardDto>(`/finance/dashboard?year=${year}`) })
}

export function useHistory(moId: string) {
  return useQuery({ queryKey: queryKeys.mediaOrders.history(moId), queryFn: () => api<{ data: AuditEntryDto[] }>(`/media-orders/${moId}/history`).then((r) => r.data) })
}

// Status penagihan mengubah detail, daftar, dashboard, dan notifikasi.
function useInvalidateBilling() {
  const qc = useQueryClient()
  return () => Promise.all(['media-orders', 'dashboard', 'notifications'].map((k) => qc.invalidateQueries({ queryKey: [k] })))
}

export function useCreateBilling(moId: string) {
  const invalidate = useInvalidateBilling()
  return useMutation({
    mutationFn: (body: { invoiceNo: string; invoiceDate: string; amount: string; overrideReason?: string; notes?: string }) =>
      api<BillingDto>(`/media-orders/${moId}/billings`, { method: 'POST', json: body }),
    onSuccess: invalidate,
  })
}

export function usePayBilling() {
  const invalidate = useInvalidateBilling()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { paidDate: string; paidAmount: string; receiptNo?: string } }) =>
      api<BillingDto>(`/billings/${id}`, { method: 'PATCH', json: body }),
    onSuccess: invalidate,
  })
}
