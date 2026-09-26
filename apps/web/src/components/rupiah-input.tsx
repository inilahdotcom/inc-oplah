import { formatRupiah } from '@inc/shared'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** Nominal Rupiah: tampil bertitik ribuan, nilai berupa string digit (AGENT.md §3: tanpa float). */
export function RupiahInput({ value, onChange, className, ...props }: Omit<React.ComponentProps<'input'>, 'value' | 'onChange'> & { value: string; onChange: (digits: string) => void }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[15px] text-ink-mute">Rp</span>
      <Input
        inputMode="numeric"
        className={cn('tnum pl-10', className)}
        value={value ? formatRupiah(value) : ''}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 15))}
        {...props}
      />
    </div>
  )
}
