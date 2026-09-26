import { billingStatusLabel, moStatusLabel, type BillingStatus, type MoStatus } from '@inc/shared'
import { Tag } from '@/components/tag'

const moTone: Record<MoStatus, 'neutral' | 'soft' | 'success' | 'danger'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'soft',
  ACTIVE: 'soft',
  COMPLETED: 'success',
  CANCELLED: 'danger',
}
const billingTone: Record<BillingStatus, 'neutral' | 'warning' | 'soft' | 'success'> = {
  NOT_READY: 'neutral',
  READY_TO_BILL: 'warning',
  BILLED: 'soft',
  PAID: 'success',
}

/** Tag status MO + status penagihan (penagihan disembunyikan untuk Draft/Dibatalkan). */
export function MoStatusTags({ status, billingStatus }: { status: MoStatus; billingStatus: BillingStatus }) {
  return (
    <>
      <Tag tone={moTone[status]}>{moStatusLabel[status]}</Tag>
      {status !== 'DRAFT' && status !== 'CANCELLED' && <Tag tone={billingTone[billingStatus]}>{billingStatusLabel[billingStatus]}</Tag>}
    </>
  )
}
