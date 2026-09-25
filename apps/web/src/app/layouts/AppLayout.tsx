import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { roleLabel } from '@inc/shared'
import { LogoMark } from '@/components/logo-mark'
import { useAuth, useCurrentUser } from '@/lib/auth-store'
import { cn } from '@/lib/utils'
import { navFor } from '../nav'

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')

// App shell sesuai README desain "Global layout": sidebar ≥ 900px, pill nav horizontal < 900px.
export function AppLayout() {
  const user = useCurrentUser()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const nav = navFor(user.role)
  const crumb = [...nav].sort((a, b) => b.to.length - a.to.length).find((n) => (n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)))?.label

  const onLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-[232px] flex-none flex-col gap-5 bg-brand-dark px-3 py-[18px] min-[900px]:flex">
        <div className="flex items-center gap-2.5 px-2.5 py-1">
          <LogoMark />
          <div className="flex flex-col">
            <span className="text-sm font-normal text-white">Inilah.com</span>
            <span className="text-xs text-white/60">Media Order</span>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5" aria-label="Navigasi utama">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/' || n.to === '/mo'}
              className={({ isActive }) =>
                cn('rounded-sm px-2.5 py-2 text-sm font-normal transition-colors hover:text-white', isActive ? 'bg-white/10 text-white' : 'text-white/72')
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-0.5 px-2.5">
          <span className="text-xs text-white/60">{user.organizationName}</span>
          <button type="button" onClick={onLogout} className="w-fit text-left text-[13px] text-white/85 hover:text-white">
            Keluar
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-hairline bg-background px-5">
          <span className="truncate text-sm text-ink-mute">Inilah.com{crumb ? ` / ${crumb}` : ''}</span>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <span className="flex size-[30px] items-center justify-center rounded-full bg-brand-dark text-xs font-normal text-white" aria-hidden>
              {initials(user.name)}
            </span>
            <div className="hidden flex-col leading-[1.2] min-[900px]:flex">
              <span className="text-[13px] font-normal">{user.name}</span>
              <span className="text-xs text-ink-mute">{roleLabel[user.role]}</span>
            </div>
          </div>
        </header>

        <nav className="flex gap-1.5 overflow-x-auto border-b border-hairline bg-canvas-soft px-4 py-2.5 min-[900px]:hidden" aria-label="Navigasi utama">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/' || n.to === '/mo'}
              className={({ isActive }) =>
                cn(
                  'rounded-full border px-3 py-1.5 text-[13px] font-normal whitespace-nowrap',
                  isActive ? 'border-primary bg-primary text-white hover:text-white' : 'border-hairline bg-background text-ink hover:text-ink',
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
          <button type="button" onClick={onLogout} className="rounded-full border border-hairline bg-background px-3 py-1.5 text-[13px] whitespace-nowrap text-ink-secondary">
            Keluar
          </button>
        </nav>

        <main className="box-border w-full max-w-[1440px] px-4 pt-5 pb-14 min-[900px]:px-8 min-[900px]:pt-7 min-[900px]:pb-16">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
