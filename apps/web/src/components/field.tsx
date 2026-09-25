import { cn } from '@/lib/utils'

/** Label + kontrol + pesan error/helper (gaya TextInput desain). Kontrol dipasang sebagai children dengan `id` yang sama. */
export function Field({
  id,
  label,
  required,
  error,
  helper,
  className,
  children,
}: {
  id: string
  label: string
  required?: boolean
  error?: string
  helper?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-normal text-ink-secondary">
        {label}
        {required && ' *'}
      </label>
      {children}
      {(error || helper) && (
        <span id={`${id}-message`} role={error ? 'alert' : undefined} className={cn('text-[13px] tracking-[-0.39px]', error ? 'text-ruby' : 'text-ink-mute')}>
          {error || helper}
        </span>
      )}
    </div>
  )
}

/** Kelas untuk <select> native agar sama dengan Input. */
export const selectClass =
  'min-h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-[15px] font-light text-ink outline-none focus-visible:border-primary focus-visible:shadow-focus aria-invalid:border-ruby disabled:bg-canvas-soft'

/** Kotak pesan (peringatan/galat) seperti di modal desain. */
export function Notice({ tone, children }: { tone: 'warning' | 'danger'; children: React.ReactNode }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('rounded-md px-3 py-2.5 text-[13px]', tone === 'warning' ? 'bg-warning-bg text-warning-text' : 'bg-danger-bg text-danger-text')}>
      {children}
    </div>
  )
}
