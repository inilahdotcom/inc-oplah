import { cn } from '@/lib/utils'

// Port docs/design/ds_reference/Tag.jsx (varian caps=false dipakai di aplikasi).
const tones = {
  soft: 'bg-primary-subdued text-primary-deep',
  neutral: 'bg-hairline text-ink-secondary',
  success: 'bg-success-bg text-success-text',
  warning: 'bg-warning-bg text-warning-text',
  danger: 'bg-danger-bg text-danger-text',
}

export function Tag({ tone = 'soft', className, children }: { tone?: keyof typeof tones; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs leading-[1.15] font-normal whitespace-nowrap', tones[tone], className)}>
      {children}
    </span>
  )
}
