import { cn } from '@/lib/utils'

// Logo sementara (README desain §Assets): kotak indigo berhuruf "i".
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn('flex size-6 items-center justify-center rounded-sm bg-primary text-xs font-medium text-white', className)}>i</span>
  )
}
