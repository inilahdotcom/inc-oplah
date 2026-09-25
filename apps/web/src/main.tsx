import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/lib/auth-store'
import { AppRoutes } from '@/app/router'
import './index.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
      <Toaster
        position="bottom-center"
        duration={3600}
        toastOptions={{ style: { background: '#0d253d', color: '#fff', border: 0, borderRadius: 8, fontSize: 14, fontWeight: 400 } }}
      />
    </QueryClientProvider>
  </StrictMode>,
)
