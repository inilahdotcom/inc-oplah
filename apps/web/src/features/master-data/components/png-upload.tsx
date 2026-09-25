import { useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

const MAX_BYTES = 2 * 1024 * 1024

/** Slot gambar PNG (tanda tangan / stempel): pratinjau atau placeholder dashed + tombol unggah. */
export function PngUpload({
  label,
  url,
  disabled,
  onUpload,
}: {
  label: string
  url: string | null
  disabled?: boolean
  onUpload: (file: File) => Promise<unknown>
}) {
  const input = useRef<HTMLInputElement>(null)

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.type !== 'image/png') return toast('File harus berupa gambar PNG.')
    if (file.size > MAX_BYTES) return toast('Ukuran file maksimal 2 MB.')
    try {
      await onUpload(file)
      toast(`${label} tersimpan.`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal mengunggah')
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-[72px] items-center justify-center rounded-md border border-dashed border-hairline-input bg-background">
        {url ? <img src={url} alt={label} className="max-h-16 max-w-full object-contain" /> : <span className="text-xs text-ink-mute">{label} (PNG transparan)</span>}
      </div>
      <input ref={input} type="file" accept="image/png" className="hidden" onChange={onChange} aria-label={`Unggah ${label}`} />
      <Button variant="ghost" size="sm" className="w-fit text-[13px]" disabled={disabled} onClick={() => input.current?.click()}>
        {url ? `Ganti ${label.toLowerCase()}` : `Unggah ${label.toLowerCase()}`}
      </Button>
    </div>
  )
}
