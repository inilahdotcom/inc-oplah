import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AuthUser, LoginInput, LoginResponse } from '@inc/shared'
import { api, refreshSession, setAccessToken, setSessionExpiredHandler } from './api-client'

type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'anonymous'; user: null }
  | { status: 'authenticated'; user: AuthUser }

interface AuthContextValue {
  state: AuthState
  login: (input: LoginInput) => Promise<AuthUser>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null })

  useEffect(() => {
    setSessionExpiredHandler(() => setState({ status: 'anonymous', user: null }))
    // Pulihkan sesi dari cookie refresh saat halaman dimuat ulang.
    refreshSession().then((res) => setState(res ? { status: 'authenticated', user: res.user } : { status: 'anonymous', user: null }))
  }, [])

  const login = useCallback(async (input: LoginInput) => {
    const res = await api<LoginResponse>('/auth/login', { method: 'POST', json: input })
    setAccessToken(res.accessToken)
    setState({ status: 'authenticated', user: res.user })
    return res.user
  }, [])

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined)
    setAccessToken(null)
    setState({ status: 'anonymous', user: null })
  }, [])

  const value = useMemo(() => ({ state, login, logout }), [state, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- hook berpasangan dengan provider
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider')
  return ctx
}

/** Untuk komponen di dalam route terproteksi. */
// eslint-disable-next-line react-refresh/only-export-components -- hook berpasangan dengan provider
export function useCurrentUser(): AuthUser {
  const { state } = useAuth()
  if (state.status !== 'authenticated') throw new Error('useCurrentUser dipakai di luar route terproteksi')
  return state.user
}
