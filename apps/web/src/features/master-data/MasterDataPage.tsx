import { Navigate, NavLink, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/page-header'
import { cn } from '@/lib/utils'
import { BenefitTypesTab } from './tabs/BenefitTypesTab'
import { FormOptionsTab } from './tabs/FormOptionsTab'
import { SalesTab } from './tabs/SalesTab'
import { CompanyTab, TaxNumberingTab } from './tabs/SettingsTabs'
import { SignatoriesTab } from './tabs/SignatoriesTab'
import { UsersTab } from './tabs/UsersTab'

const tabs = [
  { slug: 'benefit', label: 'Jenis benefit', Component: BenefitTypesTab },
  { slug: 'penandatangan', label: 'Penandatangan', Component: SignatoriesTab },
  { slug: 'sales', label: 'Sales', Component: SalesTab },
  { slug: 'opsi-formulir', label: 'Opsi formulir', Component: FormOptionsTab },
  { slug: 'pajak', label: 'Pajak & penomoran', Component: TaxNumberingTab },
  { slug: 'perusahaan', label: 'Profil perusahaan', Component: CompanyTab },
  { slug: 'pengguna', label: 'Pengguna', Component: UsersTab },
]

/** Master data Super Admin (README desain §8). Tab disimpan di URL: /pengaturan/:tab. */
export function MasterDataPage() {
  const { tab } = useParams()
  const active = tabs.find((t) => t.slug === tab)
  if (!active) return <Navigate to={`/pengaturan/${tabs[0].slug}`} replace />

  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow="Super Admin" title="Master data" />
      <nav className="flex gap-5 overflow-x-auto overflow-y-hidden border-b border-hairline" aria-label="Tab master data">
        {tabs.map((t) => (
          <NavLink
            key={t.slug}
            to={`/pengaturan/${t.slug}`}
            className={({ isActive }) =>
              cn(
                '-mb-px border-b-2 py-2.5 text-sm font-normal whitespace-nowrap',
                isActive ? 'border-primary text-primary' : 'border-transparent text-ink-mute hover:text-ink',
              )
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <active.Component />
    </div>
  )
}
