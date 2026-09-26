import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { can, type Permission } from '@inc/shared'
import { useAuth, useCurrentUser } from '@/lib/auth-store'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage'
import { ClientDetailPage } from '@/features/clients/pages/ClientDetailPage'
import { ClientListPage } from '@/features/clients/pages/ClientListPage'
import { DashboardPage } from '@/features/finance/DashboardPage'
import { MoListPage } from '@/features/finance/MoListPage'
import { MasterDataPage } from '@/features/master-data/MasterDataPage'
import { MoDetailPage } from '@/features/media-orders/pages/MoDetailPage'
import { MoFormPage } from '@/features/media-orders/pages/MoFormPage'
import { AppLayout } from './layouts/AppLayout'
import { ForbiddenPage, FullPageLoader, NotFoundPage } from './pages'

function RequireAuth() {
  const { state } = useAuth()
  const location = useLocation()
  if (state.status === 'loading') return <FullPageLoader />
  if (state.status === 'anonymous') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <AppLayout />
}

/** Guard halaman: tampilkan 403, bukan redirect diam-diam (ARCHITECTURE §3.2). */
function Guard({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  return can(useCurrentUser().role, permission) ? children : <ForbiddenPage />
}

function Home() {
  // Admin Sales tidak punya Dashboard (README desain), langsung ke Daftar MO.
  return can(useCurrentUser().role, 'viewFinanceDashboard') ? (
    <DashboardPage />
  ) : (
    <Navigate to="/mo" replace />
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/lupa-password" element={<ForgotPasswordPage />} />
      <Route element={<RequireAuth />}>
        <Route index element={<Home />} />
        <Route path="mo" element={<Guard permission="viewMo"><MoListPage /></Guard>} />
        <Route path="mo/baru" element={<Guard permission="editMo"><MoFormPage /></Guard>} />
        <Route path="mo/:id" element={<Guard permission="viewMo"><MoDetailPage /></Guard>} />
        <Route path="mo/:id/edit" element={<Guard permission="editMo"><MoFormPage /></Guard>} />
        <Route path="klien" element={<Guard permission="viewClients"><ClientListPage /></Guard>} />
        <Route path="klien/:id" element={<Guard permission="viewClients"><ClientDetailPage /></Guard>} />
        <Route path="pengaturan/:tab?" element={<Guard permission="manageMasterData"><MasterDataPage /></Guard>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
