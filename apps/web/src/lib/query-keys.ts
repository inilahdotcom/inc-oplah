export const queryKeys = {
  clients: {
    all: ['clients'] as const,
    list: (params: { q?: string; page: number }) => ['clients', 'list', params] as const,
    detail: (id: string) => ['clients', 'detail', id] as const,
    similar: (name: string, excludeId?: string) => ['clients', 'similar', name, excludeId] as const,
  },
  sales: ['master', 'sales'] as const,
  signatories: ['master', 'signatories'] as const,
  benefitTypes: ['master', 'benefit-types'] as const,
  formOptions: ['master', 'form-options'] as const,
  settings: ['master', 'settings'] as const,
  users: ['users'] as const,
}
