export const queryKeys = {
  clients: {
    all: ['clients'] as const,
    list: (params: { q?: string; page: number }) => ['clients', 'list', params] as const,
    detail: (id: string) => ['clients', 'detail', id] as const,
    similar: (name: string, excludeId?: string) => ['clients', 'similar', name, excludeId] as const,
  },
  mediaOrders: {
    all: ['media-orders'] as const,
    detail: (id: string) => ['media-orders', id] as const,
    publications: (id: string) => ['media-orders', id, 'publications'] as const,
    history: (id: string) => ['media-orders', id, 'history'] as const,
    list: (params: Record<string, string>) => ['media-orders', 'list', params] as const,
    calculate: (subtotal: string, isTaxable: boolean) => ['media-orders', 'calculate', subtotal, isTaxable] as const,
  },
  sales: ['master', 'sales'] as const,
  signatories: ['master', 'signatories'] as const,
  benefitTypes: ['master', 'benefit-types'] as const,
  formOptions: ['master', 'form-options'] as const,
  settings: ['master', 'settings'] as const,
  users: ['users'] as const,
  notifications: ['notifications'] as const,
  dashboard: (year: number) => ['dashboard', year] as const,
}
