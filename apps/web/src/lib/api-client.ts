import type { ApiErrorBody, LoginResponse } from '@inc/shared'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: { field: string; message: string }[] = [],
  ) {
    super(message)
  }
}

// Access token hanya di memori; refresh token di cookie httpOnly (ARCHITECTURE §4.2).
let accessToken: string | null = null
let onSessionExpired: () => void = () => {}

export const setAccessToken = (token: string | null) => {
  accessToken = token
}
export const setSessionExpiredHandler = (fn: () => void) => {
  onSessionExpired = fn
}

async function send(path: string, init: RequestInit & { json?: unknown }) {
  const headers = new Headers(init.headers)
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  if (init.json !== undefined) headers.set('Content-Type', 'application/json')
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  })
}

async function toError(res: Response) {
  const body = (await res.json().catch(() => null)) as ApiErrorBody | null
  return new ApiError(res.status, body?.error.code ?? 'HTTP_ERROR', body?.error.message ?? 'Terjadi kesalahan, coba lagi', body?.error.details)
}

// Satu refresh untuk banyak request 401 yang bersamaan.
let refreshing: Promise<LoginResponse | null> | null = null

export function refreshSession(): Promise<LoginResponse | null> {
  refreshing ??= send('/auth/refresh', { method: 'POST' })
    .then(async (res) => (res.ok ? ((await res.json()) as LoginResponse) : null))
    .catch(() => null)
    .then((body) => {
      setAccessToken(body?.accessToken ?? null)
      return body
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

/** Semua panggilan API lewat sini: token, refresh sekali saat 401, error standar → ApiError. */
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  let res = await send(path, init)
  if (res.status === 401 && accessToken && !path.startsWith('/auth/')) {
    if (await refreshSession()) res = await send(path, init)
    else onSessionExpired()
  }
  if (!res.ok) throw await toError(res)
  return (res.status === 204 ? undefined : await res.json()) as T
}
