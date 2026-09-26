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

// Satu refresh untuk banyak request 401 yang bersamaan di tab ini. Antar-tab/reload ditangani masa tenggang rotasi di API.
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

/** Token, refresh sekali saat 401, error standar → ApiError. */
async function request(path: string, init: RequestInit & { json?: unknown }) {
  let res = await send(path, init)
  if (res.status === 401 && accessToken && !path.startsWith('/auth/')) {
    if (await refreshSession()) res = await send(path, init)
    else onSessionExpired()
  }
  if (!res.ok) throw await toError(res)
  return res
}

/** Semua panggilan API JSON lewat sini. */
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const res = await request(path, init)
  return (res.status === 204 ? undefined : await res.json()) as T
}

/**
 * Unduh file (PDF) lewat jalur yang sama. `target` = tab yang sudah dibuka saat klik (agar tidak diblokir
 * popup blocker) untuk pratinjau; tanpa itu file disimpan dengan nama dari `Content-Disposition`.
 */
export async function downloadFile(path: string, target?: Window | null) {
  const res = await request(path, {})
  const name = /filename="?([^";]+)"?/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'dokumen.pdf'
  const url = URL.createObjectURL(await res.blob())
  if (target) target.location.href = url
  else Object.assign(document.createElement('a'), { href: url, download: name }).click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
