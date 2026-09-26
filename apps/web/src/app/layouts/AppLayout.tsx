import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { roleLabel } from '@inc/shared'
import logoDark from '@/assets/oplah-brand/oplah-logo-dark.svg'
import mark from '@/assets/oplah-brand/oplah-mark.svg'
import { NotificationBell } from '@/components/notification-bell'
import { useAuth, useCurrentUser } from '@/lib/auth-store'
import { cn } from '@/lib/utils'
import { navFor } from '../nav'

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')

const COLLAPSE_KEY = 'sidebar-collapsed'

// App shell sesuai README desain "Global layout": sidebar ≥ 900px (bisa diciutkan jadi ikon), pill nav horizontal < 900px.
export function AppLayout() {
  const user = useCurrentUser()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const nav = navFor(user.role)
  const crumb = [...nav].sort((a, b) => b.to.length - a.to.length).find((n) => (n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)))?.label

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })
  const toggle = () => {
    setCollapsed(!collapsed)
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '0' : '1')
    } catch {
      // penyimpanan diblokir: status tetap berlaku sampai reload
    }
  }

  const onLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          'sticky top-0 hidden h-screen flex-none flex-col gap-5 bg-brand-dark px-3 py-[18px] transition-[width] duration-200 min-[900px]:flex',
          collapsed ? 'w-16' : 'w-[232px]',
        )}
      >
        <div className={cn('flex items-start gap-2 py-1', collapsed ? 'flex-col items-center px-0' : 'justify-between px-2.5')}>
          {collapsed ? (
            <img src={mark} alt="Oplah" className="size-8" />
          ) : (
            <div className="flex flex-col gap-1">
              <img src={logoDark} alt="Oplah" className="h-7 w-fit" />
              <span className="text-xs text-white/60">Media Order</span>
            </div>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
            className="rounded-sm p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>
        <nav className="flex flex-col gap-0.5" aria-label="Navigasi utama">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/' || n.to === '/mo'}
              title={collapsed ? n.label : undefined}
              aria-label={collapsed ? n.label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-sm py-2 text-sm font-normal transition-colors hover:text-white',
                  collapsed ? 'justify-center px-0' : 'px-2.5',
                  isActive ? 'bg-white/10 text-white' : 'text-white/72',
                )
              }
            >
              <n.icon className="size-4 flex-none" aria-hidden />
              {!collapsed && n.label}
            </NavLink>
          ))}
        </nav>
        <div className={cn('mt-auto flex flex-col gap-0.5', collapsed ? 'items-center' : 'px-2.5')}>
          {!collapsed && <span className="text-xs text-white/60">{user.organizationName}</span>}
          <button
            type="button"
            onClick={onLogout}
            title={collapsed ? 'Keluar' : undefined}
            aria-label={collapsed ? 'Keluar' : undefined}
            className="flex w-fit items-center gap-2 py-1 text-left text-[13px] text-white/85 hover:text-white"
          >
            <LogOut className="size-4" aria-hidden />
            {!collapsed && 'Keluar'}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-hairline bg-background px-5">
          <span className="truncate text-sm text-ink-mute">Inilah.com{crumb ? ` / ${crumb}` : ''}</span>
          <div className="flex-1" />
          <NotificationBell />
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
                  'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-normal whitespace-nowrap',
                  isActive ? 'border-primary bg-primary text-white hover:text-white' : 'border-hairline bg-background text-ink hover:text-ink',
                )
              }
            >
              <n.icon className="size-3.5 flex-none" aria-hidden />
              {n.label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1.5 rounded-full border border-hairline bg-background px-3 py-1.5 text-[13px] whitespace-nowrap text-ink-secondary"
          >
            <LogOut className="size-3.5" aria-hidden />
            Keluar
          </button>
        </nav>

        <main className="box-border w-full px-4 pt-5 pb-14 min-[900px]:px-8 min-[900px]:pt-7 min-[900px]:pb-16">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
