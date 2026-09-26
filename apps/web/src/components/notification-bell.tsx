import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Popover } from '@base-ui/react/popover'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatTanggal, type NotificationDto } from '@inc/shared'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'

const TITLE: Record<NotificationDto['type'], string> = {
  MO_READY_TO_BILL: 'MO siap ditagih',
  MO_PERIOD_ENDING: 'Periode MO segera berakhir',
  MO_BILLING_OVERRIDE: 'MO ditagih sebelum benefit penuh',
}

/** FR-NOT-01: lonceng notifikasi in-app (README desain §10). Polling tiap 60 detik. */
export function NotificationBell() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const query = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => api<{ data: NotificationDto[]; unread: number }>('/notifications'),
    refetchInterval: 60_000,
  })
  const markRead = useMutation({
    mutationFn: (id?: string) => api<void>(id ? `/notifications/${id}/read` : '/notifications/read-all', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications }),
  })
  const unread = query.data?.unread ?? 0

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-[13px] text-ink-secondary hover:bg-canvas-soft">
        Notifikasi
        <span className={cn('tnum min-w-5 rounded-full px-1.5 text-center text-xs text-white', unread > 0 ? 'bg-ruby' : 'bg-ink-mute')}>{unread}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="end" className="z-50">
          <Popover.Popup className="flex max-h-[70vh] w-[380px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-xl border border-hairline bg-background shadow-l2 outline-none">
            <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
              <Popover.Title className="text-sm font-normal">Notifikasi</Popover.Title>
              {unread > 0 && (
                <button type="button" className="text-[13px] text-primary" onClick={() => markRead.mutate(undefined)}>
                  Tandai semua dibaca
                </button>
              )}
            </div>
            <div className="overflow-y-auto">
              {query.data?.data.length ? (
                query.data.data.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className="flex w-full gap-3 border-b border-hairline px-4 py-3 text-left last:border-b-0 hover:bg-canvas-soft"
                    onClick={() => {
                      if (!n.readAt) markRead.mutate(n.id)
                      setOpen(false)
                      navigate(`/mo/${n.payload.moId}`)
                    }}
                  >
                    <span className={cn('mt-1.5 size-2 flex-none rounded-full', n.readAt ? 'bg-transparent' : 'bg-primary')} aria-label={n.readAt ? undefined : 'Belum dibaca'} />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm">
                        {TITLE[n.type]} <span className="tnum">{n.payload.moNumber}</span>
                      </span>
                      <span className="truncate text-[13px] text-ink-mute">{n.payload.companyName}</span>
                      <span className="text-xs text-ink-mute">{formatTanggal(n.createdAt)}</span>
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-4 py-6 text-center text-sm text-ink-mute">Belum ada notifikasi.</p>
              )}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
